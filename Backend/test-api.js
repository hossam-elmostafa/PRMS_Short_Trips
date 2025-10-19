const baseUrl = 'http://localhost:3000/api';

async function testAPI() {
  console.log('Testing Travel Management API...\n');

  try {
    console.log('1. Testing getCities...');
    let response = await fetch(`${baseUrl}/cities`);
    let data = await response.json();
    console.log('Cities:', data.data.slice(0, 3));

    console.log('\n2. Testing getHotelsByCity...');
    response = await fetch(`${baseUrl}/hotels/القاهرة`);
    data = await response.json();
    console.log('Cairo Hotels:', data.data.slice(0, 2));

    console.log('\n3. Testing getEmployeeById...');
    response = await fetch(`${baseUrl}/employee/100325`);
    data = await response.json();
    console.log('Employee:', data.data.name);

    console.log('\n4. Testing getEmployeeCompanions...');
    response = await fetch(`${baseUrl}/employee/100325/companions`);
    data = await response.json();
    console.log('Companions count:', data.data.length);

    console.log('\n5. Testing getRoomTypes...');
    response = await fetch(`${baseUrl}/room-types`);
    data = await response.json();
    console.log('Room Types:', data.data.map(rt => rt.ar));

    console.log('\n6. Testing calculateRoomPrice...');
    response = await fetch(`${baseUrl}/calculate-room-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId: 'c_fs_nile',
        date: '2025-10-25',
        roomTypeKey: 'double'
      })
    });
    data = await response.json();
    console.log('Room Price:', data.data.price, 'EGP');

    console.log('\n7. Testing getExtraBedPrice...');
    response = await fetch(`${baseUrl}/extra-bed-price/c_fs_nile`);
    data = await response.json();
    console.log('Extra Bed Price:', data.data.price, 'EGP');

    console.log('\n8. Testing calculateTripTotal...');
    response = await fetch(`${baseUrl}/calculate-trip-total`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotelId: 'c_fs_nile',
        date: '2025-10-25',
        roomCounts: { double: 2, single: 1 },
        extraBedCounts: { double: 1 }
      })
    });
    data = await response.json();
    console.log('Total:', data.data.total, 'EGP');
    console.log('Employee Share (60%):', data.data.employeeShare, 'EGP');

    console.log('\n9. Testing getTransportAllowance...');
    response = await fetch(`${baseUrl}/transport-allowance/القاهرة`);
    data = await response.json();
    console.log('Transport Allowance:', data.data.allowance, 'EGP');

    console.log('\n10. Testing getHotelMaxExtraBeds...');
    response = await fetch(`${baseUrl}/hotel/c_fs_nile/extra-beds`);
    data = await response.json();
    console.log('Max Extra Beds per Room Type:', data.data);

    console.log('\n✅ All API tests completed successfully!');

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testAPI();
