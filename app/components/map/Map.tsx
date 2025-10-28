'use client';

import dynamic from 'next/dynamic';
import type { MapProps } from './MapInner';

const MapInner = dynamic(() => import('./MapInner'), { ssr: false });
export default function Map(props: MapProps) {
    return <MapInner {...props} />;
}