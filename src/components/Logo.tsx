import React from "react";
import Image from "next/image";

export interface LogoProps {
  variant?: "transparent" | "square" | "full";
  size?: number;
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
}

const logoPaths = {
  transparent: "/logo-transparent.png",
  square: "/logos/logo-square.png",
  full: "/logo.png",
};

export const Logo: React.FC<LogoProps> = ({
  variant = "transparent",
  size,
  width,
  height,
  className = "",
  alt = "Injasraj Logo",
  priority = false,
}) => {
  const w = width ?? size ?? 48;
  const h = height ?? size ?? (variant === "full" ? Math.round(w * (572 / 1024)) : w);

  return (
    <Image
      src={logoPaths[variant]}
      alt={alt}
      width={w}
      height={h}
      priority={priority}
      className={`inline-block object-contain ${className}`}
    />
  );
};

export default Logo;
