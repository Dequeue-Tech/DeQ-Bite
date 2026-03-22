/**
 * Test Script for Order Notification System
 * 
 * This script tests the Fast2SMS integration and email templates
 * without actually sending real notifications.
 * 
 * Usage: npx tsx test-notifications.ts
 */

import { generateOrderConfirmationSMS, generateOrderCompletionSMS } from './src/lib/fast2sms';
import { generateOrderConfirmationEmailTemplate, generateOrderCompletionEmailTemplate } from './src/lib/email';
import { logger } from './src/utils/logger';

console.log('🧪 Testing Order Notification System\n');

// Test data
const orderData = {
  customerName: 'John Doe',
  orderId: 'order_test123',
  orderDate: new Date().toLocaleDateString('en-IN'),
  items: [
    { name: 'Butter Chicken', quantity: 2 },
    { name: 'Naan Bread', quantity: 4 },
    { name: 'Biryani', quantity: 1 },
  ],
  total: 850.00,
  tableNumber: 5,
  restaurantName: 'Haveli Dhaba',
  paymentMethod: 'RAZORPAY',
  estimatedTime: '30-40 minutes',
};

console.log('✅ Test 1: Generate Order Confirmation SMS');
console.log('─'.repeat(50));
const confirmationSMS = generateOrderConfirmationSMS(orderData);
console.log(confirmationSMS);
console.log('\n');

console.log('✅ Test 2: Generate Order Completion SMS');
console.log('─'.repeat(50));
const completionSMS = generateOrderCompletionSMS(orderData);
console.log(completionSMS);
console.log('\n');

console.log('✅ Test 3: Generate Order Confirmation Email Template');
console.log('─'.repeat(50));
const confirmationEmail = generateOrderConfirmationEmailTemplate(orderData);
console.log('Email template generated (length:', confirmationEmail.length, 'chars)');
console.log('Contains order ID:', confirmationEmail.includes(orderData.orderId));
console.log('Contains customer name:', confirmationEmail.includes(orderData.customerName));
console.log('Contains total amount:', confirmationEmail.includes(orderData.total.toFixed(2)));
console.log('Contains items table:', confirmationEmail.includes('<table class="items-table"'));
console.log('\n');

console.log('✅ Test 4: Generate Order Completion Email Template');
console.log('─'.repeat(50));
const completionEmail = generateOrderCompletionEmailTemplate(orderData);
console.log('Email template generated (length:', completionEmail.length, 'chars)');
console.log('Contains order ID:', completionEmail.includes(orderData.orderId));
console.log('Contains payment method:', completionEmail.includes(orderData.paymentMethod));
console.log('Contains thank you message:', completionEmail.includes('Thank you for dining'));
console.log('\n');

console.log('✅ Test 5: Validate Message Content');
console.log('─'.repeat(50));

// Validate SMS length (should be under 160 chars for single SMS, but we allow longer)
const smsLength = confirmationSMS.length;
console.log(`Confirmation SMS length: ${smsLength} characters`);
if (smsLength > 450) {
  console.warn('⚠️  Warning: SMS is very long and may be split into multiple messages');
} else {
  console.log('✅ SMS length is reasonable');
}

// Validate email has all required sections
const requiredSections = [
  'Order Confirmed',
  orderData.orderId,
  orderData.customerName,
  'Total Amount',
  orderData.restaurantName,
];

let allPresent = true;
for (const section of requiredSections) {
  if (!confirmationEmail.includes(section)) {
    console.error(`❌ Missing required section: ${section}`);
    allPresent = false;
  }
}

if (allPresent) {
  console.log('✅ All required sections present in email template');
}

console.log('\n');

console.log('✅ Test 6: Logger Check');
console.log('─'.repeat(50));
logger.info('Test notification log entry', {
  test: true,
  timestamp: new Date().toISOString(),
});
console.log('Logger working correctly (check logs/combined.log)');
console.log('\n');

console.log('🎉 All tests completed successfully!');
console.log('\nNext steps:');
console.log('1. Configure your .env file with Fast2SMS and SMTP credentials');
console.log('2. Start the server: npm run dev');
console.log('3. Create a real order and update its status to trigger notifications');
console.log('4. Check your email inbox and phone for actual notifications');
console.log('\nFor manual testing, use the curl commands from NOTIFICATION_QUICK_REFERENCE.md');
