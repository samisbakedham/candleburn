import { Text, HStack, Box, Tbody, Thead, Tr, VStack, ListItem, UnorderedList } from "@chakra-ui/react";
import { Card } from "../../atoms/Card";
import { TablePlus, TdPlus, ThPlus } from "../../atoms/TablePlus";
import { useBlockExplorer } from "../../contexts/BlockExplorerContext";
import { BigNumberText } from "../../organisms/BigNumberText";
import { GasUsed, GasUsedPercent } from "../../organisms/GasUsed";
import { absoluteTime, timeSince } from "../../utils/time";
import { BlockStats } from "../../libs/ethereum";
import { maxBlocksToRenderInTable, Tooltips } from "../../config";
import { layoutConfig } from "../../layoutConfig";
import { LogoIcon } from "../../atoms/LogoIcon";
import { TooltipPlus } from "../../atoms/TooltipPlus";

function TooltipGasUsedInfo() {
  return (
    <Box>
      <Text size="xs">Gas used is % of gas target. The base fee for the next block will change depending on the percentage:</Text>
      <UnorderedList mt={4} spacing={2}>
        <ListItem>100% == no change in base fee</ListItem>
        <ListItem>200% == 12.5% increase in base fee</ListItem>
        <ListItem>0% == 12.5% decrease in base fee</ListItem>
      </UnorderedList>
    </Box>
  );
}

function BlockItem({ block }: { block: BlockStats }) {
  const transactionPercentage = block.transactions === 0 ? 0 : (block.type2transactions / block.transactions * 100).toFixed(0);
  return (
    <Tr>
      <TdPlus>{block.number}</TdPlus>
      <TdPlus><VStack alignItems="flex-end"><HStack><BigNumberText number={block.burned} /><LogoIcon /></HStack></VStack></TdPlus>
      <TdPlus textAlign="right"><BigNumberText number={block.tips} /></TdPlus>
      <TdPlus textAlign="right"><BigNumberText number={block.rewards} /></TdPlus>
      <TdPlus textAlign="right"><BigNumberText number={block.baseFee} /></TdPlus>
      <TdPlus textAlign="right"><BigNumberText number={block.priorityFee} /></TdPlus>
      <TdPlus textAlign="right">
        <VStack alignItems="flex-end">
          <HStack>
            <GasUsed gasUsed={block.gasUsed} />
            <GasUsedPercent gasUsed={block.gasUsed} gasTarget={block.gasTarget} />
          </HStack>
        </VStack>
      </TdPlus>
      <TdPlus textAlign="right">
        <VStack alignItems="flex-end">
          <HStack>
            <Text>{block.transactions}</Text>
            <Text variant="brandSecondary" fontSize="xs" w="40px">({transactionPercentage}%)</Text>
          </HStack>
        </VStack>
      </TdPlus>
      <TdPlus textAlign="right" title={absoluteTime(block.timestamp)}>{timeSince(block.timestamp)}</TdPlus>
    </Tr>
  );
}

function ThPlusTooltip({ children, tooltip }: { children: React.ReactNode, tooltip: React.ReactNode }) {
  return <ThPlus><VStack alignItems="flex-end"><HStack><Text>{children}</Text><TooltipPlus placement="top" label={tooltip} /></HStack></VStack></ThPlus>
}

export function BlockList() {
  const { data: { blocks } } = useBlockExplorer();

  return (
    <Box position="relative" h="100%" flex={1} overflow="auto" whiteSpace="nowrap" ml="-10px" mr="-10px">
      <TablePlus>
        <Thead>
          <Tr>
            <ThPlus textAlign="left" width="0.1%">Block</ThPlus>
            <ThPlusTooltip tooltip={Tooltips.burned}>Burned</ThPlusTooltip>
            <ThPlusTooltip tooltip={Tooltips.tips}>Tips</ThPlusTooltip>
            <ThPlusTooltip tooltip={Tooltips.rewards}>Rewards</ThPlusTooltip>
            <ThPlusTooltip tooltip={Tooltips.baseFee}>Base Fee</ThPlusTooltip>
            <ThPlusTooltip tooltip={Tooltips.priorityFee}>Priority Fee</ThPlusTooltip>
            <ThPlusTooltip tooltip={<TooltipGasUsedInfo />}>Gas Used</ThPlusTooltip>
            <ThPlusTooltip tooltip={Tooltips.transactions}>Txn</ThPlusTooltip>
            <ThPlus>Age</ThPlus>
          </Tr>
        </Thead>
        <Tbody>
          {blocks.slice(0, maxBlocksToRenderInTable).map((block) => (
            <BlockItem
              key={block.number}
              block={block} />
          ))}
        </Tbody>
      </TablePlus>
    </Box>
  );
}

export function CardBlocks() {
  return (
    <Card
      flex={layoutConfig.flexStretch}
      h={{ base: 400, md: "auto" }}
    >
      <BlockList />
    </Card>
  );
}
