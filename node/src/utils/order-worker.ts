
// const { Worker } = require("bullmq");
// const { connection } = require("./order-queue");

// // Implement these functions using your actual database
// // and notification service.
// const orderService = require("./services/order-service");
// const notificationService = require("./services/notification-service");

// const worker = new Worker(
//   "order-processing",
//   async (job) => {
//     const { orderId } = job.data;

//     switch (job.name) {
//       case "vendor-order-reminder": {
//         const order = await orderService.getOrder(orderId);

//         if (!order) return;

//         // Only notify vendors for unanswered orders.
//         if (order.status !== "AWAITING_VENDOR") {
//           return;
//         }

//         await notificationService.sendVendorReminder({
//           vendorId: order.vendorId,
//           orderId,
//           elapsedMinutes: job.data.elapsedMinutes,
//         });

//         break;
//       }

//       case "cancel-unanswered-order": {
//         // This method MUST atomically check eligibility,
//         // transition the order, and release/refund funds
//         // exactly once.
//         const result =
//           await orderService.cancelIfStillUnanswered(
//             orderId
//           );

//         if (!result.cancelled) {
//           return;
//         }

//         // Use a durable outbox or equivalent so the
//         // cancellation notification is not lost.
//         await notificationService.notifyOrderCancelled({
//           orderId,
//           buyerId: result.buyerId,
//           vendorId: result.vendorId,
//         });

//         break;
//       }

//       default:
//         throw new Error(`Unknown job: ${job.name}`);
//     }
//   },
//   {
//     connection,
//     concurrency: 10,
//   }
// );

// worker.on("completed", (job) => {
//   console.log(`Job completed: ${job.id}`);
// });

// worker.on("failed", (job, error) => {
//   console.error(
//     `Job failed: ${job?.id}`,
//     error.message
//   );
// });

// worker.on("error", (error) => {
//   console.error("BullMQ worker error:", error);
// });

// async function shutdown() {
//   await worker.close();
//   await connection.quit();
// }

// process.on("SIGTERM", shutdown);
// process.on("SIGINT", shutdown);
