"use client";

interface AssetIconProps {
  asset: string;
  className?: string;
}

export default function AssetIcon({ asset, className = "h-5 w-5" }: AssetIconProps) {
  if (asset === "BTC") {
    return (
      <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#F7931A"/>
        <path d="M22.478 14.05c.384-2.57-1.57-3.95-4.204-4.86l.86-3.454-2.1-.524-.835 3.35c-.55-.138-1.11-.265-1.675-.392l.84-3.368-2.1-.524-.86 3.45c-.456-.104-.903-.206-1.34-.304l0 0-2.888-.724-.555 2.23s1.57.359 1.537.384c.857.215 1.013.78.995 1.23l-.997 4.004c.06.015.137.037.222.067-.07-.018-.147-.037-.223-.055l-1.4 5.616c-.106.265-.373.662-.978.514.021.03-1.534-.385-1.534-.385l-2.097 2.38 2.72.68c.505.127 1 .249 1.494.367l-.87 3.49 2.1.524.864-3.466c.573.147 1.134.286 1.686.416l-.864 3.46 2.1.524.87-3.49c3.56.672 6.237.402 7.36-2.828.912-2.607-.046-4.1-1.926-5.078 1.37-.318 2.405-1.224 2.68-3.082zM17.8 20.87c-.647 2.59-5.096 1.187-6.532.83l1.156-4.64c1.436.36 6.057 1.02 5.376 3.81zm.65-6.64c-.59 2.36-4.34 1.15-5.55.816l1.04-4.176c1.21.303 5.14.864 4.51 3.36z" fill="#fff"/>
      </svg>
    );
  }

  if (asset === "ETH") {
    return (
      <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#627EEA"/>
        <path d="M16 4v9.29l8.16 3.65L16 4z" fill="#fff" fillOpacity="0.601"/>
        <path d="M16 4L7.84 16.94 16 13.29V4z" fill="#fff"/>
        <path d="M16 21.71v6.29l8.16-11.54L16 21.71z" fill="#fff" fillOpacity="0.601"/>
        <path d="M16 28v-6.29l-8.16-5.25L16 28z" fill="#fff"/>
        <path d="M16 20.43l8.16-4.79L16 13.29v7.14z" fill="#fff" fillOpacity="0.2"/>
        <path d="M7.84 15.64L16 20.43v-7.14l-8.16 2.35z" fill="#fff" fillOpacity="0.601"/>
      </svg>
    );
  }

  // Generic asset icon for unknown assets (SOL, etc.)
  const initial = asset.charAt(0).toUpperCase();
  return (
    <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#19BEA4"/>
      <text x="16" y="21" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="bold" fontFamily="sans-serif">{initial}</text>
    </svg>
  );
}
