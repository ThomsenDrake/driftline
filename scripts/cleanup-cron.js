// This script can be deployed as a Supabase Edge Function or cron job
// to automatically clean up expired thoughts every hour

export async function handler(event) {
  try {
    // Import the cleanup function
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/cleanup-expired`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Cleanup failed');
    }

    console.log('Cleanup completed:', result.message);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Cleanup error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Cleanup failed' }),
    };
  }
}

// For local development, you can run this manually
if (import.meta.main) {
  handler();
}