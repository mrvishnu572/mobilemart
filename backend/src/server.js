import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { expireStaleRazorpayOrders } from "./services/razorpay.service.js";

const startServer = async () => {
  await connectDatabase();

  app.listen(env.PORT, () => {
    console.log(`MobileMart API is running on port ${env.PORT}`);
  });
  const paymentExpiryTimer = setInterval(() => {
    expireStaleRazorpayOrders().catch((error) => console.error("Razorpay expiry cleanup failed:", error.message));
  }, 60 * 1000);
  paymentExpiryTimer.unref();
};

startServer().catch((error) => {
  console.error("Unable to start MobileMart API:", error.message);
  process.exit(1);
});

