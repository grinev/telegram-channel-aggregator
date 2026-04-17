import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main(): Promise<void> {
  const apiId = await question('Enter your API ID: ');
  const apiHash = await question('Enter your API Hash: ');
  const phoneNumber = await question('Enter your phone number (e.g. +1234567890): ');

  const session = new StringSession('');
  const client = new TelegramClient(session, Number(apiId), apiHash, {
    connectionRetries: 5,
  });

  console.log('\nConnecting to Telegram...');

  await client.start({
    phoneNumber: async () => phoneNumber,
    phoneCode: async () => {
      const code = await question('Enter the code you received: ');
      return code;
    },
    password: async () => {
      const password = await question('Enter your 2FA password (if enabled): ');
      return password;
    },
    onError: (err: Error) => {
      console.error('Auth error:', err.message);
    },
  });

  const sessionString = session.save();

  console.log('\n========== SUCCESS ==========');
  console.log('Copy this StringSession to your .env file:\n');
  console.log(`TELEGRAM_STRING_SESSION=${sessionString}`);
  console.log('\n=============================');

  await client.disconnect();
  rl.close();
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
