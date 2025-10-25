'use client';

import dynamic from 'next/dynamic';

const RelayMapInner = dynamic(() => import('./RelayMapInner'), { ssr: false });
export interface RelayPoint {
    id: string;
    name: string;
    address: string;
    zipcode: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    carrier: string;
    distance?: number;
}
export interface RelayMapProps {
    points: RelayPoint[];
    center: [number, number];
    onSelectPoint: (point: RelayPoint) => void;
    selectedPointId?: string;
}
export default function RelayMap(props: RelayMapProps) {
    return <RelayMapInner {...props} />;
}