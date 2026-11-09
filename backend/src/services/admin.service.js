import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getDashboardSummary = async ({ startDate, endDate } = {}) => {
  const selectedDateMatch = {};
  if (startDate) selectedDateMatch.$gte = new Date(`${startDate}T00:00:00.000Z`);
  if (endDate) selectedDateMatch.$lte = new Date(`${endDate}T23:59:59.999Z`);
  const orderDateMatch = Object.keys(selectedDateMatch).length ? { createdAt: selectedDateMatch } : {};
  const filteredOrderMatch = { ...orderDateMatch };

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

  const [
    userCount,
    productCount,
    orderCount,
    pendingOrders,
    revenue,
    statusBreakdown,
    recentOrders,
    lowStockProducts,
    monthlySales,
    topSellingProducts,
    paymentBreakdown,
    promoPerformance,
    cancelledOrders,
    deliveredOrders,
  ] = await Promise.all([
    User.countDocuments({ accountStatus: "active" }),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(filteredOrderMatch),
    Order.countDocuments({ ...filteredOrderMatch, orderStatus: "pending" }),
    Order.aggregate([
      { $match: { ...filteredOrderMatch, paymentStatus: "paid", orderStatus: { $ne: "cancelled" } } },
      { $group: { _id: null, totalPaise: { $sum: "$totalPaise" }, paidOrderCount: { $sum: 1 } } },
    ]),
    Order.aggregate([{ $match: filteredOrderMatch }, { $group: { _id: "$orderStatus", count: { $sum: 1 } } }]),
    Order.find()
      .populate("user", "displayName email username")
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Product.find({ "variants.stock": { $lte: 5 } })
      .select("name brand variants images slug")
      .limit(8)
      .lean(),
    Order.aggregate([
      { $match: { ...filteredOrderMatch, orderStatus: { $ne: "cancelled" } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          orders: { $sum: 1 },
          revenuePaise: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalPaise", 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { ...filteredOrderMatch, orderStatus: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      {
        $project: {
          product: "$items.product",
          quantity: {
            $max: [
              0,
              { $subtract: ["$items.quantity", { $ifNull: ["$items.cancelledQuantity", 0] }] },
            ],
          },
        },
      },
      { $group: { _id: "$product", unitsSold: { $sum: "$quantity" } } },
      { $sort: { unitsSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: Product.collection.name,
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          unitsSold: 1,
          name: { $ifNull: ["$productDetails.name", "Deleted product"] },
          brand: { $ifNull: ["$productDetails.brand", ""] },
          images: { $ifNull: ["$productDetails.images", []] },
        },
      },
    ]),
    Order.aggregate([
      { $match: filteredOrderMatch },
      { $group: { _id: "$paymentMethod", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Order.aggregate([
      { $match: { ...filteredOrderMatch, promoCode: { $ne: "" } } },
      {
        $group: {
          _id: "$promoCode",
          uses: { $sum: 1 },
          discountPaise: { $sum: "$discountPaise" },
        },
      },
      { $sort: { uses: -1 } },
      { $limit: 5 },
    ]),
    Order.countDocuments({ ...filteredOrderMatch, orderStatus: "cancelled" }),
    Order.countDocuments({ ...filteredOrderMatch, orderStatus: "delivered" }),
  ]);

  const ordersByStatus = {
    pending: 0,
    confirmed: 0,
    packed: 0,
    shipped: 0,
    delivered: 0,
    partially_cancelled: 0,
    cancelled: 0,
  };

  statusBreakdown.forEach((item) => {
    if (ordersByStatus[item._id] !== undefined) {
      ordersByStatus[item._id] = item.count;
    }
  });

  const monthLabels = [];
  const rangeStart = startDate ? new Date(`${startDate}T00:00:00`) : sixMonthsAgo;
  const rangeEnd = endDate ? new Date(`${endDate}T00:00:00`) : new Date();
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const finalMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  while (cursor <= finalMonth && monthLabels.length < 24) {
    monthLabels.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      label: cursor.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const salesByMonth = new Map(monthlySales.map((item) => [item._id, item]));
  const monthlySalesData = monthLabels.map((month) => {
    const value = salesByMonth.get(month.key);
    return {
      month: month.label,
      orders: value?.orders || 0,
      revenuePaise: value?.revenuePaise || 0,
    };
  });

  const revenuePaise = revenue[0]?.totalPaise || 0;
  const paidOrderCount = revenue[0]?.paidOrderCount || 0;

  return {
    userCount,
    productCount,
    orderCount,
    pendingOrders,
    revenuePaise,
    averageOrderValuePaise: paidOrderCount ? Math.round(revenuePaise / paidOrderCount) : 0,
    paidOrderCount,
    cancelledOrders,
    deliveredOrders,
    cancellationRate: orderCount ? Math.round((cancelledOrders / orderCount) * 100) : 0,
    ordersByStatus,
    recentOrders,
    lowStockProducts,
    monthlySales: monthlySalesData,
    topSellingProducts,
    paymentBreakdown,
    promoPerformance,
  };
};

export const listUsers = async ({ search = "", page = 1, limit = 20 } = {}) => {
  const query = {};
  if (search) {
    const safeSearch = escapeRegex(search).slice(0, 100);
    query.$or = [
      { displayName: { $regex: safeSearch, $options: "i" } },
      { email: { $regex: safeSearch, $options: "i" } },
      { username: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const numericPage = Math.max(1, Number(page) || 1);
  const numericLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit)
      .lean(),
    User.countDocuments(query),
  ]);

  // Attach order counts for these users
  const userIds = users.map((u) => u._id);
  const orderCounts = await Order.aggregate([
    { $match: { user: { $in: userIds } } },
    { $group: { _id: "$user", count: { $sum: 1 }, totalSpent: { $sum: "$totalPaise" } } },
  ]);

  const countMap = new Map();
  orderCounts.forEach((c) => {
    countMap.set(String(c._id), { count: c.count, totalSpent: c.totalSpent });
  });

  const enrichedUsers = users.map((u) => ({
    ...u,
    orderCount: countMap.get(String(u._id))?.count || 0,
    totalSpentPaise: countMap.get(String(u._id))?.totalSpent || 0,
  }));

  return {
    users: enrichedUsers,
    pagination: {
      page: numericPage,
      limit: numericLimit,
      total,
      pages: Math.ceil(total / numericLimit),
    },
  };
};

export const updateUser = async (userId, updateData) => {
  // Admins may suspend/reactivate customer accounts, but role changes are
  // deliberately not supported by this endpoint. Admin creation is handled
  // only by the trusted server-side create:admin script.
  const target = await User.findById(userId).select("role");
  if (!target) {
    throw new AppError("User not found.", 404);
  }
  if (target.role === "admin") {
    throw new AppError("Administrator accounts cannot be suspended or changed here.", 403);
  }
  if (!updateData?.accountStatus) {
    throw new AppError("Provide an account status.", 400);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { accountStatus: updateData.accountStatus } },
    { new: true, runValidators: true }
  );
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  return user;
};

export const listAllProducts = async ({ search = "", category, brand, page = 1, limit = 50 } = {}) => {
  const query = {};
  if (search) {
    const safeSearch = escapeRegex(search).slice(0, 100);
    query.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { brand: { $regex: safeSearch, $options: "i" } },
    ];
  }
  if (category) query.category = category;
  if (brand) query.brand = brand;

  const numericPage = Math.max(1, Number(page) || 1);
  const numericLimit = Math.min(100, Math.max(1, Number(limit) || 50));

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit)
      .lean(),
    Product.countDocuments(query),
  ]);

  return {
    products,
    pagination: {
      page: numericPage,
      limit: numericLimit,
      total,
      pages: Math.ceil(total / numericLimit),
    },
  };
};

export const deleteProduct = async (productId) => {
  const product = await Product.findByIdAndDelete(productId);
  if (!product) {
    throw new AppError("Product not found.", 404);
  }
  return { message: "Product deleted successfully" };
};
