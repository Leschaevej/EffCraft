"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import "./Cropper.scss";

type CropperProps = {
    src: string;
    onCancel: () => void;
    onConfirm: (croppedDataUrl: string) => void;
};

export default function Cropper({ src, onCancel, onConfirm }: CropperProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [dragging, setDragging] = useState(false);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [minZoom, setMinZoom] = useState(1);
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({
        width: 0,
        height: 0,
    });
    const onImageLoad = () => {
        if (!imgRef.current) return;
        setNaturalSize({
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight,
        });
    };
    const calculateMinZoom = () => {
        if (!containerRef.current || !naturalSize.width || !naturalSize.height) return 1;
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        const zoomX = containerWidth / naturalSize.width;
        const zoomY = containerHeight / naturalSize.height;
        return Math.max(zoomX, zoomY);
    };
    const constrainPosition = (x: number, y: number, zoomLevel: number) => {
        if (!containerRef.current) return { x, y };
            const containerWidth = containerRef.current.clientWidth;
            const containerHeight = containerRef.current.clientHeight;
            const displayedWidth = naturalSize.width * zoomLevel;
            const displayedHeight = naturalSize.height * zoomLevel;
            let newX = x;
            let newY = y;
        if (displayedWidth > containerWidth) {
        if (newX > 0) newX = 0;
        if (newX < containerWidth - displayedWidth) newX = containerWidth - displayedWidth;
        } else {
            newX = (containerWidth - displayedWidth) / 2;
        }
        if (displayedHeight > containerHeight) {
        if (newY > 0) newY = 0;
        if (newY < containerHeight - displayedHeight) newY = containerHeight - displayedHeight;
        } else {
            newY = (containerHeight - displayedHeight) / 2;
        }
        return { x: newX, y: newY };
    };
    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setDragging(true);
        setStartPos({ x: e.clientX, y: e.clientY });
    };
    const onMouseMove = (e: MouseEvent) => {
        if (!dragging || !startPos) return;
            const dx = e.clientX - startPos.x;
            const dy = e.clientY - startPos.y;
            setPosition((pos) => {
            let newX = pos.x + dx;
            let newY = pos.y + dy;
            const constrained = constrainPosition(newX, newY, zoom);
            setStartPos({ x: e.clientX, y: e.clientY });
        return constrained;
        });
    };
    const onMouseUp = () => {
        setDragging(false);
        setStartPos(null);
    };
    useEffect(() => {
        if (dragging) {
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        } else {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        }
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [dragging, startPos]);
    useEffect(() => {
        if (!naturalSize.width || !naturalSize.height) return;
            const newMinZoom = calculateMinZoom();
            setMinZoom(newMinZoom);
            setZoom(newMinZoom);
            const initialPos = constrainPosition(0, 0, newMinZoom);
            setPosition(initialPos);
    }, [naturalSize, src]);
    useEffect(() => {
        const constrained = constrainPosition(position.x, position.y, zoom);
        setPosition(constrained);
    }, [zoom, naturalSize.width, naturalSize.height]);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
            const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const zoomStep = 0.1;
            let newZoom = zoom - e.deltaY * zoomStep * 0.01;
        if (newZoom < minZoom) newZoom = minZoom;
        if (newZoom > 3) newZoom = 3;
        const rect = container.getBoundingClientRect();
        const offsetX = e.clientX - rect.left - position.x;
        const offsetY = e.clientY - rect.top - position.y;
        const zoomFactor = newZoom / zoom;
        let newX = position.x - offsetX * (zoomFactor - 1);
        let newY = position.y - offsetY * (zoomFactor - 1);
        const constrainedPos = constrainPosition(newX, newY, newZoom);
        setZoom(newZoom);
        setPosition(constrainedPos);
        };
            container.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            container.removeEventListener("wheel", handleWheel);
        };
    }, [zoom, minZoom, position, constrainPosition]);
    const handleConfirm = useCallback(() => {
        const container = containerRef.current;
        const img = imgRef.current;
        if (!container || !img) return;
            const cropWidth = container.clientWidth;
            const cropHeight = container.clientHeight;
            const canvas = document.createElement("canvas");
            canvas.width = cropWidth;
            canvas.height = cropHeight;
            const ctx = canvas.getContext("2d");
        if (!ctx) return;
            let sx = -position.x / zoom;
            let sy = -position.y / zoom;
            sx = Math.min(Math.max(sx, 0), naturalSize.width - cropWidth / zoom);
            sy = Math.min(Math.max(sy, 0), naturalSize.height - cropHeight / zoom);
            ctx.drawImage(
            img,
            sx,
            sy,
            cropWidth / zoom,
            cropHeight / zoom,
            0,
            0,
            cropWidth,
            cropHeight
        );
        const croppedDataUrl = canvas.toDataURL("image/webp", 0.9);
        onConfirm(croppedDataUrl);
    }, [position.x, position.y, zoom, onConfirm, naturalSize.width, naturalSize.height]);
    useEffect(() => {
        setPosition({ x: 0, y: 0 });
        setZoom(1);
    }, [src]);
    const displayedWidth = naturalSize.width * zoom;
    const displayedHeight = naturalSize.height * zoom;
    return (
        <div
            ref={containerRef}
            className={`cropper-container ${dragging ? "dragging" : ""}`}
            style={{ aspectRatio: "4 / 5" }}
            >
            <img
                ref={imgRef}
                src={src}
                alt="À recadrer"
                onLoad={onImageLoad}
                className="cropper-image"
                style={{
                top: position.y,
                left: position.x,
                width: displayedWidth,
                height: displayedHeight,
                }}
                draggable={false}
                onMouseDown={onMouseDown}
            />
            <button onClick={handleConfirm} className="cropper-button confirm">
                Valider
            </button>
            <button onClick={onCancel} className="cropper-button cancel">
                Annuler
            </button>
        </div>
    );
}