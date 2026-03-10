import { ImgHTMLAttributes } from 'react';

export default function AppLogoIcon(props: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src="/assets/img/unifast.png"
            alt="UniFAST Logo"
            {...props}
        />
    );
}
