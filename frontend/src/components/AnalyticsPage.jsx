import React, { useState, useEffect } from "react";
import { Box, VStack, Heading } from "@chakra-ui/react";
import axios from "axios";
import { BASE_URL } from "../services/api";
import GradientLineChart from "./GradientLineGraph";
import TopCategoriesBarChart from "./TopCategoriesBarChart";
import { Flex } from "@chakra-ui/react";
import "chart.js/auto";

const AnalyticsPage = () => {
  const [labels, setLabels] = useState([]);
  const [data, setData] = useState([]);

  useEffect(() => {
    axios
      .get(`${BASE_URL}/arts/dates/`)
      .then((response) => {
        console.log(response);

        const localDates = response.data.map((utcStr) => {
          const convertedTimeStr = utcStr.replace(" ", "T") + "Z";
          return new Date(convertedTimeStr);
        });

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const uploadsByHour = localDates.reduce((acc, date) => {
          if (date >= oneDayAgo && date <= now) {
            const hour = date.getHours();
            acc[hour] = (acc[hour] || 0) + 1;
          }
          return acc;
        }, {});

        console.log(uploadsByHour);

        const currentHour = now.getHours();
        const newLabels = Array.from({ length: 24 }, (_, i) => {
          let hour = (currentHour - i + 24) % 24;
          return `${hour}:00`;
        }).reverse();

        const newData = newLabels.map((label) => {
          const hour = parseInt(label, 10);
          return uploadsByHour[hour] || 0;
        });

        setLabels(newLabels);
        setData(newData);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
      });
  }, []);

  return (
    <VStack spacing={8} align="stretch" pt={20}>
      <Box p={5} shadow="md" borderWidth="1px" borderRadius="md">
        <Flex justify="center">
          <Heading size="lg" mb={4}>
            Uploads Last 24 Hours
          </Heading>
        </Flex>
        {labels.length > 0 && data.length > 0 && (
          <GradientLineChart labels={labels} data={data} />
        )}
      </Box>
      <Box p={5} shadow="md" borderWidth="1px" borderRadius="md" bg="white">
        <Flex justify="center">
          <Heading size="lg" mb={4}>
            Top Categories
          </Heading>
        </Flex>
        <TopCategoriesBarChart />
      </Box>
    </VStack>
  );
};

export default AnalyticsPage;
