"use client";

import React, { ReactElement } from "react";
import "./Carousel.scss";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";

interface CarouselProps {
  children: ReactElement[];
  itemsPerPage?: number;
  pageIndex: number;
  setPageIndex: React.Dispatch<React.SetStateAction<number>>;
}

export default function Carousel({
  children,
  itemsPerPage = 6,
  pageIndex,
  setPageIndex,
}: CarouselProps) {
  const totalPages = Math.ceil(children.length / itemsPerPage);

  const pages = Array.from({ length: totalPages }, (_, i) =>
    children.slice(i * itemsPerPage, (i + 1) * itemsPerPage)
  );

  const handlePrev = () => {
    setPageIndex((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  };

  const handleNext = () => {
    setPageIndex((prev) => (prev === totalPages - 1 ? 0 : prev + 1));
  };

  return (
    <div className="carousel">
      <div className="controls">
        <button onClick={handlePrev} aria-label="Précédent">
          <MdChevronLeft />
        </button>
        <button onClick={handleNext} aria-label="Suivant">
          <MdChevronRight />
        </button>
      </div>
      <div className="items">
        <div
          className="inner"
          style={{ transform: `translateX(-${pageIndex * 100}%)` }}
        >
          {pages.map((pageItems, i) => (
            <div className="page" key={i}>
              {pageItems}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
