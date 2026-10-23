
// import { Queue } from "bullmq";
// import IORedis from "ioredis";

// const connection = new IORedis(process.env.REDIS_URL, {
//   maxRetriesPerRequest: null,
// });

// const orderQueue = new Queue("order-processing", {
//   connection,
// });

// const REMINDER_INTERVAL = 15 * 60 * 1000;
// const CANCELLATION_TIMEOUT = 120 * 60 * 1000;

// async function scheduleOrderJobs(order) {
//   const orderId = order.id;

//   // Use the persisted order creation timestamp.
//   const createdAt = new Date(order.createdAt).getTime();
//   const now = Date.now();

//   // Schedule reminders at 15, 30, 45 ... 105 minutes.
//   for (
//     let elapsed = 15;
//     elapsed < 120;
//     elapsed += 15
//   ) {
//     const dueAt = createdAt + elapsed * 60 * 1000;
//     const delay = Math.max(0, dueAt - now);

//     await orderQueue.add(
//       "vendor-order-reminder",
//       {
//         orderId,
//         elapsedMinutes: elapsed,
//       },
//       {
//         delay,
//         jobId: `reminder-${orderId}-${elapsed}`,
//         attempts: 3,
//         backoff: {
//           type: "exponential",
//           delay: 5000,
//         },
//         removeOnComplete: true,
//       }
//     );
//   }

//   // Schedule automatic cancellation at 120 minutes.
//   const cancelDueAt =
//     createdAt + CANCELLATION_TIMEOUT;

//   await orderQueue.add(
//     "cancel-unanswered-order",
//     { orderId },
//     {
//       delay: Math.max(0, cancelDueAt - now),
//       jobId: `cancel-${orderId}`,
//       attempts: 5,
//       backoff: {
//         type: "exponential",
//         delay: 5000,
//       },
//       removeOnComplete: true,
//     }
//   );
// }

// module.exports = {
//   scheduleOrderJobs,
//   orderQueue,
//   connection,
// };
