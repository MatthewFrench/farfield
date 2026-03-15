import webPush from "web-push";

const keys = webPush.generateVAPIDKeys();

process.stdout.write("Add these to your environment:\n\n");
process.stdout.write("PUSH_ENABLED=true\n");
process.stdout.write(`PUSH_VAPID_PUBLIC_KEY=${keys.publicKey}\n`);
process.stdout.write(`PUSH_VAPID_PRIVATE_KEY=${keys.privateKey}\n`);
process.stdout.write("PUSH_VAPID_SUBJECT=mailto:you@example.com\n");
