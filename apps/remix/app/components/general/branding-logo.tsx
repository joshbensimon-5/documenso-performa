import type { ImgHTMLAttributes } from 'react';

export type LogoProps = ImgHTMLAttributes<HTMLImageElement>;

export const BrandingLogo = ({ width = '180', height = '24', ...props }: LogoProps) => {
  return <img src="/static/logo.png" alt="Logo" width={width} height={height} {...props} />;
};
