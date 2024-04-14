import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";
import { Box } from "@chakra-ui/react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

const fixedHeight = 600;

const GradientLineChart = ({ labels, data }) => {
  const getGradient = (ctx, chartArea) => {
    const { top, bottom } = chartArea;
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(1, "rgba(233, 30, 99, 0.6)");
    gradient.addColorStop(0.5, "rgba(255, 140, 0, 0.6)");
    gradient.addColorStop(0, "rgba(255, 87, 34, 0.6)");
    return gradient;
  };

  const chartData = {
    labels,
    datasets: [
      {
        label: "Number of Uploads",
        data,
        fill: true,
        borderColor: "rgba(233, 30, 99, 0.6)",
        backgroundColor: function (context) {
          const chart = context.chart;
          const { ctx, chartArea } = chart;

          if (!chartArea) {
            return null;
          }
          return getGradient(ctx, chartArea);
        },
        tension: 0.4,
      },
    ],
  };

  const options = {
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: Math.max(...data) + 2,
        callback: function (value, index, values) {
          return value.toInt();
        },
        stepSize: 1,
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: function (context) {
            return `${context.dataset.label || ""}: ${
              context.parsed.y
            } uploads`;
          },
        },
      },
    },
  };

  return (
    <Box p={5} style={{ height: `${fixedHeight}px`, width: "100%" }}>
      <Line data={chartData} options={options} />
    </Box>
  );
};

export default GradientLineChart;
