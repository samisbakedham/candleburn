import { Text } from "@chakra-ui/react";
import { BigNumber } from "ethers";

export function GasTarget({gasTarget}: {gasTarget: BigNumber}) {
  return (
        <Text size="sm">{gasTarget.toNumber().toLocaleString(undefined, {'minimumFractionDigits': 0, 'maximumFractionDigits': 0})}</Text>
  )
}

export function GasUsed({gasUsed}: {gasUsed: BigNumber}) {
  return (
        <Text size="sm">{gasUsed.toNumber().toLocaleString(undefined, {'minimumFractionDigits': 0, 'maximumFractionDigits': 0})}</Text>
  )
}

export function GasUsedPercent({gasUsed, gasTarget, basicStyle }: {gasUsed: BigNumber, gasTarget: BigNumber, basicStyle?: boolean}) {
  const gasUsedNumber = gasUsed.toNumber()
  const gasTargetNumber = gasTarget.toNumber()
  const percentage = (gasUsedNumber / gasTargetNumber * 100).toFixed(0)

  if (basicStyle) {
    return <Text>{percentage}%</Text>
  }

  return (
        <Text w="40px" fontSize="xs" variant="brandSecondary">({percentage}%)</Text>
  )
}
