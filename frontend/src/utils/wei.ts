import { BigNumber, utils } from "ethers";


const MinBoundEther = utils.parseUnits("0.00009", "ether");
const MinBoundGwei = utils.parseUnits("0.00001", "gwei");

interface AutoFormatType {
  value: string
  currency: 'ETH' | 'GWEI' | 'WEI' | ''
}

export function autoFormatBigNumber(
  number: BigNumber
): AutoFormatType {
  let formatted: AutoFormatType = { value: '0', currency: 'WEI'};

  if (!number || number.isZero()) {
    return formatted
  }

  if (number.gt(MinBoundEther)) {
    formatted = { value: utils.formatUnits(number, 'ether'), currency: 'ETH'};
  } else if (number.lt(MinBoundGwei)) {
    formatted = { value: utils.formatUnits(number, 'wei'), currency: 'WEI'};
  } else {
    formatted = { value: utils.formatUnits(number, 'gwei'), currency: 'GWEI'};
  }

  if (formatted.value.endsWith('.0'))
    formatted.value = formatted.value.substr(0, formatted.value.length - 2)

  return formatted;
}

export function autoFormatBigNumberToString(
  number: BigNumber
): string {
  const formatter = autoFormatBigNumber(number)
  return `${formatter.value} ${formatter.currency}`
}
