import React from 'react';
import * as LucideIcons from 'lucide-react';
import { HelpCircle } from 'lucide-react';

function BrandX({
    size = 24,
    color = "currentColor",
    className = "",
    ...props
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            <path
                d="M4 3H8.68235L13.2367 9.47864L18.6809 3H20.9649L14.2549 10.979L22 21H17.3176L12.5023 14.1517L6.74284 21H4.45884L11.4844 12.6511L4 3ZM7.22372 4.8H5.51482L17.7763 19.2H19.4852L7.22372 4.8Z"
                fill={color}
            />
        </svg>
    );
}

function BrandPinterest({
    size = 24,
    color = "currentColor",
    className = "",
    ...props
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            <path
                d="M12 2C6.47715 2 2 6.47715 2 12C2 16.2283 4.62647 19.8432 8.34118 21.2907C8.25098 20.4947 8.17033 19.2726 8.38849 18.384L9.65538 13.0194C9.65538 13.0194 9.33259 12.3578 9.33259 11.3797C9.33259 9.83285 10.2281 8.67642 11.343 8.67642C12.2922 8.67642 12.7504 9.38939 12.7504 10.2457C12.7504 11.2038 12.1408 12.6363 11.8294 13.9507C11.5684 15.0552 12.385 15.9549 13.4734 15.9549C15.4486 15.9549 16.7687 13.8723 16.7687 10.8714C16.7687 8.24343 14.8795 6.40778 12.1832 6.40778C9.10643 6.40778 7.30587 8.72063 7.30587 11.1105C7.30587 12.0685 7.67321 13.0962 8.13324 13.6533C8.22441 13.7627 8.23745 13.8584 8.21047 13.9737C8.12028 14.3531 7.91538 15.2026 7.87946 15.3529C7.83156 15.5511 7.72248 15.5929 7.49638 15.4938C5.97767 14.8447 5.0285 12.7982 5.0285 11.0094C5.0285 7.19599 7.79982 3.69427 13.0191 3.69427C17.2071 3.69427 20.4584 6.68047 20.4584 10.6711C20.4584 14.8425 17.8308 18.2015 14.1828 18.2015C13.0222 18.2015 11.936 17.5963 11.5638 16.8816L10.8508 19.6085C10.5921 20.602 9.88601 21.8488 9.27181 22.6112C10.1564 22.8744 11.0937 23 12 23C17.5228 23 22 18.5228 22 13C22 7.47715 17.5228 2 12 2Z"
                fill={color}
            />
        </svg>
    );
}

const CUSTOM_ICONS = {
    BrandPinterest,
    BrandX
};

function Icon({
    name,
    size = 24,
    color = "currentColor",
    className = "",
    strokeWidth = 2,
    ...props
}) {
    const IconComponent = CUSTOM_ICONS?.[name] || LucideIcons?.[name];

    if (!IconComponent) {
        return <HelpCircle size={size} color="gray" strokeWidth={strokeWidth} className={className} {...props} />;
    }

    return <IconComponent
        size={size}
        color={color}
        strokeWidth={strokeWidth}
        className={className}
        {...props}
    />;
}
export default Icon;
