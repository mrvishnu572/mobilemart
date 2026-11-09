
import * as orderService from "../services/order.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { generateInvoicePdf } from "../utils/invoice-pdf.js";

export const create = asyncHandler(async (request, response) => {
  const idempotencyKey = request.get("Idempotency-Key");

  const order = await orderService.createOrder(
    request.user.id,
    request.body,
    idempotencyKey,
  );

  response.status(201).json({
    success: true,
    data: { order },
  });
});


export const listAvailablePromotions = asyncHandler(async (request, response) => {
  const promotions = await orderService.getAvailableCheckoutPromotions(request.user.id);
  response.status(200).json({ success: true, data: { promotions } });
});

export const quote = asyncHandler(async (request, response) => {
  const quoteResult = await orderService.getOrderQuote(
    request.user.id,
    request.body.promoCode,
    request.body.deliveryState,
  );

  response.status(200).json({
    success: true,
    data: { quote: quoteResult },
  });
});

export const listMine = asyncHandler(async (request, response) => {
  const result = await orderService.listUserOrders(
    request.user.id,
    request.query,
  );

  response.status(200).json({
    success: true,
    data: result,
  });
});

export const getMine = asyncHandler(async (request, response) => {
  const order = await orderService.getUserOrder(
    request.user.id,
    request.params.id,
  );

  response.status(200).json({
    success: true,
    data: { order },
  });
});

export const cancelOrderItem = asyncHandler(async (request, response) => {
  const order = await orderService.cancelOrderItem(
    request.user.id,
    request.params.id,
    request.body,
  );
  response.status(200).json({ success: true, data: { order } });
});

export const cancelMine = asyncHandler(async (request, response) => {
  const order = await orderService.cancelPendingOrder(
    request.user.id,
    request.params.id,
  );

  response.status(200).json({
    success: true,
    data: { order },
  });
});

export const listAll = asyncHandler(async (request, response) => {
  const result = await orderService.listAllOrders(request.query);

  response.status(200).json({
    success: true,
    data: result,
  });
});

export const updateStatus = asyncHandler(async (request, response) => {
  const order = await orderService.updateOrderStatus(
    request.params.id,
    request.body,
  );

  response.status(200).json({
    success: true,
    data: { order },
  });
});

export const getInvoice = asyncHandler(async (request, response, next) => {
  const isAdmin = request.user?.role === "admin";
  const invoice = await orderService.getOrderInvoice(
    request.user.id,
    request.params.id,
    isAdmin,
  );

  response.setHeader("Content-Type", "application/pdf");

  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${invoice.invoiceNumber}.pdf"`,
  );

  try {
    const doc = generateInvoicePdf(invoice, response);

    doc.on("error", (error) => {
      console.error("Invoice PDF stream error:", error);

      if (response.headersSent) {
        response.destroy(error);
        return;
      }

      next(error);
    });
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }

    next(error);
  }
});

export const createReturnExchange = asyncHandler(async (request, response) => {
  const result = await orderService.createReturnExchangeRequest(request.user.id, request.params.id, request.body);
  response.status(201).json({ success: true, data: { request: result } });
});

export const listMyReturnExchange = asyncHandler(async (request, response) => {
  const requests = await orderService.listMyReturnExchangeRequests(request.user.id);
  response.status(200).json({ success: true, data: { requests } });
});
