import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 글봄 메인 컬러
        teal: {
          DEFAULT: "#1D9E75",
          50: "#E8F7F1",
          100: "#C5EBDA",
          500: "#1D9E75",
          600: "#177D5C",
          700: "#125F46",
        },
        // 루브릭 영역별 색상
        area: {
          content: "#1D9E75",
          structure: "#378ADD",
          expression: "#7F77DD",
          grammar: "#D85A30",
          volume: "#BA7517",
        },
        // 따뜻한 뉴트럴 배경
        bg: {
          DEFAULT: "#fafaf6",
          subtle: "#f5f4ee",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
