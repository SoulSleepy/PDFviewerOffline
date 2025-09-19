import type { FC, ReactNode } from "react"


interface IProps {
    width: number
    height: number
    fill: string
    viewBox?: string
    children: ReactNode
}

export const IconWrapper: FC<IProps> = (props) => {
    const { width, height, fill, viewBox = '', children } = props

    return (
        <svg
            width={width}
            height={height}
            viewBox={viewBox || `0 0 ${width} ${height}`}
            fill={fill}
            xmlns='http://www.w3.org/2000/svg'
        >
            {children}
        </svg>
    )
}
