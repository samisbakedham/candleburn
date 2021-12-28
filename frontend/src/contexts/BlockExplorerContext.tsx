import { useContext, createContext, useEffect, useState } from "react"
import { useEthereum } from "./EthereumContext"
import { BigNumber, utils } from 'ethers'
import { Loader } from "../organisms/Loader";
import { maxBlocksToRenderInChart, maxBlocksToRenderInChartMobile, serverVersion } from "../config";
import { BigNumberMax, BigNumberMin, Zero } from "../utils/number";
import { BaseData, BlockData, BlockStats, InitialData, Totals } from "../libs/ethereum";
import { Announcement } from "../organisms/Announcement";
import { isMobileWidth } from "./MobileDetectorContext";

export interface BlockExplorerSession {
  burned: BigNumber
  tips: BigNumber
  blockCount: number
  transactionCount: number
  rewards: BigNumber
  minBaseFee?: BigNumber
  maxBaseFee?: BigNumber
  since: number
}

export interface BlockExplorerDetails extends BaseData {
  currentBlock: number
  currentBaseFee: BigNumber
  currentPriorityFee: BigNumber
}

interface BlocksChanged {
  details: BlockExplorerDetails
  blocks: BlockStats[]
  session: BlockExplorerSession
}

type BlockExplorerContextType = {
  data: BlocksChanged
  error?: string
  getBlockStats?(index: number): BlockStats | undefined
}
const DefaultTotals: Totals = {
  baseFee: 0,
  baseFeePercentiles: {
    Maximum: 0,
    Median: 0,
    Minimum: 0,
    ninetieth: 0,
  },
  burned: Zero,
  rewards: Zero,
  tips: Zero,
  issuance: Zero,
  netReduction: 0,
}

const DefaultExplorerData = {
  blocks: [],
  details: {
    totals: DefaultTotals,
    totalsHour: DefaultTotals,
    totalsDay: DefaultTotals,
    totalsWeek: DefaultTotals,
    totalsMonth: DefaultTotals,
    clients: 0,
    version: 'NA',
    usdPrice: 1,
    currentBlock: 0,
    currentBaseFee: Zero,
    currentPriorityFee: Zero,
  },
  session: {
    burned: Zero,
    tips: Zero,
    blockCount: 0,
    transactionCount: 0,
    rewards: Zero,
    minBaseFee: Zero,
    maxBaseFee: Zero,
    since: Date.now()
  }
}

const BlockExplorerContext = createContext<BlockExplorerContextType>({ data: DefaultExplorerData})

const useBlockExplorer = () => useContext(BlockExplorerContext);

interface InMemoryIndex {
  insert: (data: BlockData) => void
  getBlockStats: (index: number) => BlockStats | undefined
  getData: () => BlocksChanged
}

const CreateMemoryIndex = (initialData: InitialData): InMemoryIndex => {
  const blockIndex: {[blockNumber: number]: BlockStats} = {}
  let blocks: number[] = []
  let originalTitle = document.title

  const details: BlockExplorerDetails = {
    currentBlock: initialData.blockNumber,
    currentBaseFee: initialData.blocks.length ? initialData.blocks[0].baseFee : Zero,
    currentPriorityFee: initialData.blocks.length ? initialData.blocks[0].priorityFee : Zero,
    totals: initialData.totals,
    totalsHour: initialData.totalsHour,
    totalsDay: initialData.totalsDay,
    totalsWeek: initialData.totalsWeek,
    totalsMonth: initialData.totalsMonth,
    clients: initialData.clients,
    version: initialData.version,
    usdPrice: initialData.usdPrice,
  }

  const session: BlockExplorerSession = {
    blockCount: 0,
    burned: Zero,
    rewards: Zero,
    tips: Zero,
    transactionCount: 0,
    since: Date.now()
  }

  const getData = (): BlocksChanged => {
    return {
      details,
      session,
      blocks: blocks.map((blockNumber: number) => blockIndex[blockNumber]),
    }
  }

  const updateTitle = () => {
    const baseFeeInGwei = parseInt(utils.formatUnits(details.currentBaseFee, 'gwei'))
    document.title = baseFeeInGwei + " GWEI | " +  originalTitle
  }

  const insert = (data: BlockData) => {
    const { block, totals, totalsHour, totalsDay, totalsWeek, totalsMonth, clients, version, usdPrice } = data

    if (blockIndex[block.number]) {
      console.log('repeat', block.number);
      return
    }

    if (!block.burned.isZero()) {
      session.burned = session.burned.add(block.burned)
    }

    if (!block.tips.isZero()) {
      session.tips = session.tips.add(block.tips)
    }

    if (!block.rewards.isZero()) {
      session.rewards = session.rewards.add(block.rewards)
    }

    details.currentBaseFee = block.baseFee
    details.currentPriorityFee = block.priorityFee
    details.currentBlock = block.number
    details.totals = totals
    details.totalsHour = totalsHour
    details.totalsDay = totalsDay
    details.totalsWeek = totalsWeek
    details.totalsMonth = totalsMonth
    details.clients = clients
    details.version = version
    details.usdPrice = usdPrice
    session.blockCount = session.blockCount + 1
    session.transactionCount = session.transactionCount + block.transactions
    session.minBaseFee = session.minBaseFee ? BigNumberMin(block.baseFee, session.minBaseFee) : block.baseFee
    session.maxBaseFee = session.maxBaseFee ? BigNumberMax(block.baseFee, session.maxBaseFee) : block.baseFee

    blockIndex[block.number] = block
    blocks = [block.number, ...blocks]
    
    updateTitle()
  }

  const getBlockStats = (blockNumber: number): BlockStats => {
    return blockIndex[blockNumber]
  }

  initialData.blocks.forEach((block: BlockStats) => {
    if (blockIndex[block.number]) {
      console.log('repeat', block.number);
      return;
    }
    blockIndex[block.number] = block
    blocks.push(block.number)
  })

  updateTitle()

  return {
    insert,
    getBlockStats,
    getData
  }
}

const BlockExplorerProvider = ({
  children
}: {
  children: React.ReactNode
}) => {
  const { eth } = useEthereum()
  const [db, setDb] = useState<InMemoryIndex>()
  const [error, setError] = useState<string>()
  const [data, setData] = useState<BlocksChanged>(DefaultExplorerData)

  useEffect(() => {
    if (!eth)
      return

    let index: InMemoryIndex;

    const onVersionError = (version: string) => {
      if (serverVersion !== version) {
        setError(`New website update available, please refresh to get the new updates.`)
        return true;
      }

      return false;
    }

    const onNewData = (data: BlockData) => {
      if (onVersionError(data.version)) {
        return;
      }

      index.insert(data)
      setData(index.getData())
    }

    const init = async () => {
      const initialData = await eth.getInitialData(isMobileWidth() ? maxBlocksToRenderInChartMobile : maxBlocksToRenderInChart)
      if (onVersionError(initialData.version)) {
        return false;
      }

      index = CreateMemoryIndex(initialData)
      setDb(index);
      setData(index.getData())

      // Start the websocket listener.
      eth.on('data', onNewData)

      return true;
    }

    const initialized = init()
    
    return () => {
      initialized.then(() => eth.off('data', onNewData))
    }
  }, [eth])

  return (
    <BlockExplorerContext.Provider
      value={{data: data, getBlockStats: db?.getBlockStats, error}}>
      {!db && error ? <Announcement isOverlay /> : null }
      {db ? children : <Loader>retrieving latest blocks on {eth?.connectedNetwork.name}</Loader>}
    </BlockExplorerContext.Provider>
  )
}

export { useBlockExplorer, BlockExplorerProvider }
