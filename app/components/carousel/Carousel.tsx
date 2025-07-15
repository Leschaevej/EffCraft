"use client";

import React, { ReactElement, useEffect, useRef } from "react";
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
  itemsPerPage = 8,
  pageIndex,
  setPageIndex,
}: CarouselProps) {
  const totalPages = Math.ceil(children.length / itemsPerPage);
  const pages = Array.from({ length: totalPages }, (_, i) =>
    children.slice(i * itemsPerPage, (i + 1) * itemsPerPage)
  );

  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleTransitionEnd = () => {
      if (pageIndex === -1) {
        if (innerRef.current) {
          innerRef.current.style.transition = "none";
          innerRef.current.style.transform = `translateX(-${totalPages * 100}%)`;
        }
        requestAnimationFrame(() => {
          setPageIndex(totalPages - 1);
          if (innerRef.current) {
            void innerRef.current.offsetWidth;
            innerRef.current.style.transition = "transform 1s ease";
          }
        });
      }

      if (pageIndex === totalPages) {
        if (innerRef.current) {
          innerRef.current.style.transition = "none";
          innerRef.current.style.transform = `translateX(-100%)`;
        }
        requestAnimationFrame(() => {
          setPageIndex(0);
          if (innerRef.current) {
            void innerRef.current.offsetWidth;
            innerRef.current.style.transition = "transform 1s ease";
          }
        });
      }
    };

    const ref = innerRef.current;
    if (ref) {
      ref.addEventListener("transitionend", handleTransitionEnd);
      return () => ref.removeEventListener("transitionend", handleTransitionEnd);
    }
  }, [pageIndex, totalPages, setPageIndex]);

  const handlePrev = () => setPageIndex((prev) => prev - 1);
  const handleNext = () => setPageIndex((prev) => prev + 1);

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
          ref={innerRef}
          style={{ transform: `translateX(-${(pageIndex + 1) * 100}%)` }}
        >
          <div className="page" key="last-clone">
            {pages[pages.length - 1]}
          </div>
          {pages.map((pageItems, i) => (
            <div className="page" key={i}>
              {pageItems}
            </div>
          ))}
          <div className="page" key="first-clone">
            {pages[0]}
          </div>
        </div>
      </div>
    </div>
  );
}