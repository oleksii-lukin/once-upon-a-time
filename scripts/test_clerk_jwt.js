// Test script to verify Clerk JWT configuration
// Run this in your browser console while logged in to check the JWT

async function testClerkJWT() {
    try {
        // This assumes you're using Clerk's useAuth hook
        const { getToken } = window.Clerk;

        if (!getToken) {
            console.error('❌ Clerk is not loaded or user is not authenticated');
            return;
        }

        const token = await getToken({ template: 'supabase' });

        if (!token) {
            console.error('❌ No token received. Make sure:');
            console.error('   1. You have created a JWT template named "supabase" in Clerk Dashboard');
            console.error('   2. The template is properly configured with your Supabase JWT secret');
            console.error('   3. You are signed in');
            return;
        }

        console.log('✅ Token received successfully!');
        console.log('Token length:', token.length);

        // Decode the JWT to inspect its contents
        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            console.log('✅ JWT Payload:', payload);
            console.log('User ID (sub):', payload.sub);
            console.log('Issued at:', new Date(payload.iat * 1000).toISOString());
            console.log('Expires at:', new Date(payload.exp * 1000).toISOString());

            if (payload.sub && payload.sub.startsWith('user_')) {
                console.log('✅ Clerk user ID format is correct');
            } else {
                console.warn('⚠️  Unexpected user ID format:', payload.sub);
            }
        } else {
            console.error('❌ Invalid JWT format');
        }

    } catch (error) {
        console.error('❌ Error testing JWT:', error);
    }
}

// Run the test
console.log('🔍 Testing Clerk JWT configuration...');
testClerkJWT();
