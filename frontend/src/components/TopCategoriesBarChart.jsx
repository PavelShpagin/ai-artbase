import React, { useState, useEffect, useRef } from "react";
import { Bar } from "react-chartjs-2";
import "chart.js/auto";
import axios from "axios";
import { Box } from "@chakra-ui/react";
import { BASE_URL } from "../services/api.js";

const fixedHeight = 600;

const TopCategoriesBarChart = () => {
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [
      {
        label: "Top Categories",
        data: [],
        backgroundColor: [],
      },
    ],
  });

  const chartRef = useRef(null);

  useEffect(() => {
    axios
      .get(`${BASE_URL}/categories/top/`)
      .then((response) => {
        const topCategories = response.data;
        const labels = topCategories.map((category) => category.name);
        const data = topCategories.map((category) => category.count);

        const chartContext = chartRef.current.ctx;
        const canvas = chartContext.canvas;
        const gradient = chartContext.createLinearGradient(
          0,
          0,
          canvas.width,
          0
        );
        gradient.addColorStop(0, "rgba(149, 76, 233, 0.5)"); // light purple
        gradient.addColorStop(1, "rgba(75, 0, 130, 0.5)"); // dark purple

        setChartData({
          labels: labels,
          datasets: [
            {
              label: "Top Categories",
              data: data,
              backgroundColor: gradient,
            },
          ],
        });
      })
      .catch((error) => {
        console.error("Error fetching categories:", error);
      });
  }, []);

  const options = {
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (val) {
            if (val % 1 === 0) {
              return val;
            }
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  };

  return (
    <Box p={5} style={{ height: `${fixedHeight}px`, width: "100%" }}>
      <Bar ref={chartRef} data={chartData} options={options} />
    </Box>
  );
};

export default TopCategoriesBarChart;
