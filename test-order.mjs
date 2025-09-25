async function testOrderCreation() {
  try {
    // First, login to get a token
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'customer@example.com',
        password: 'customer123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login successful:', loginData);
    
    if (!loginData.success) {
      console.log('Login failed');
      return;
    }
    
    const token = loginData.data.token;
    console.log('Token:', token);
    
    // Now try to create an order
    const orderData = {
      tableId: 'table_2',
      items: [
        {
          menuItemId: 'main-1',
          quantity: 1,
          notes: ''
        }
      ],
      specialInstructions: ''
    };
    
    console.log('Sending order data:', JSON.stringify(orderData, null, 2));
    
    const orderResponse = await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
    
    const orderDataResponse = await orderResponse.json();
    console.log('Order creation response:', orderDataResponse);
  } catch (error) {
    console.error('Error:', error);
  }
}

testOrderCreation();