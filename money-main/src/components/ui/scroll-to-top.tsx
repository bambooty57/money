"use client";
import { useEffect, useState } from "react";

export default function ScrollToTop({ threshold = 300, label = "⬆️ 맨위로", className = "" }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > threshold);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!show) return null;
  return (
    <button
      onClick={handleScrollTop}
      className={`fixed bottom-8 right-8 z-50 bg-blue-600 text-white text-2xl font-bold px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-blue-300 ${className}`}
      aria-label="맨위로 가기"
    >
      {label}
    </button>
  );
} 