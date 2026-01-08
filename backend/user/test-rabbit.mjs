import amqp from "amqplib";

const url = "amqp://vivek:vivek321@127.0.0.1:5672/";

try {
  const conn = await amqp.connect(url);
  console.log("✅ CONNECTED TO RABBITMQ");
  await conn.close();
  process.exit(0);
} catch (err) {
  console.error("❌ FAILED TO CONNECT", err);
  process.exit(1);
}
