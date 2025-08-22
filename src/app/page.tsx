'use client';

import dynamic from 'next/dynamic';

// Dynamically import MapLibre to avoid SSR issues
const MapLibreMap = dynamic(
  () => import('@/components/MapLibreMap'),
  {
    ssr: false,
    loading: () => (
      <div style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f0f0'
      }}>
        <div>Loading map...</div>
      </div>
    )
  }
);

export default function Home() {
  return <MapLibreMap />;
}