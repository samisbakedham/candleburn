package main

import (
	"database/sql"
	"flag"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/params"
	_ "github.com/mattn/go-sqlite3"
	watchtheburn "github.com/mohamedmansour/ethereum-burn-stats/daemon/sql"
)

var (
	dbPath = flag.String("db-path", "watchtheburn.db", "WatchTheBurn Database SQLite Path")
)

type WatchTheBurnBlockStat struct {
	Number            uint 
	Timestamp         uint64
	BaseFee           big.Int
	Burned            big.Int
	GasTarget         uint64
	GasUsed           uint64
	GasUsedPercentage float64
	PriorityFee       big.Int
	Rewards           big.Int
	Tips              big.Int
	Transactions      uint64
	Type2Transactions uint64
}

func main() {
	flag.Parse()

	db, err := sql.Open("sqlite3", *dbPath)
	if err != nil {
		panic(err)
	}

	queryCount := "SELECT number as count FROM block_stats ORDER BY number DESC LIMIT 1"
	rowCount, err := db.Query(queryCount)
	if err != nil {
		panic(err)
	}

	var count uint
	if rowCount.Next() {
		err = rowCount.Scan(&count)
		if err != nil {
			panic(err)
		}
	}

	queryAll := "SELECT * FROM block_stats"
	rows, err := db.Query(queryAll)
	if err != nil {
		panic(err)
	}

	blocksFull := BlocksFull{}
	blocksFull.Initialize(count)

	for rows.Next() {
		var cl watchtheburn.BlockStats
		err = rows.Scan(&cl.Number, &cl.Timestamp, &cl.BaseFee, &cl.Burned, &cl.GasTarget, &cl.GasUsed, &cl.PriorityFee, &cl.Rewards, &cl.Tips, &cl.Transactions, &cl.Type2Transactions)
		if err != nil {
			panic(err)
		}

		blocksFull.ProcessBlock(cl)
	}

	blocksFull.PrintPercentageFull(90)
	blocksFull.PrintPercentageFull(95)
	blocksFull.PrintPercentageFull(99)
}

const (
	FullTrackingBucket    = 100
	FullConsecutiveBucket = 200
	ConsecutiveCount      = 3
)

type ComplexRecord struct {
	Total big.Int
	Min big.Int
	Max big.Int
}

type RecordStreak struct {
	StartBlock uint
	EndBlock uint
	Burned ComplexRecord
	Rewards ComplexRecord
	Tips ComplexRecord
	BaseFee ComplexRecord
	PriorityFee ComplexRecord
	TotalTransactions uint
	TotalType2Transactions uint
}

func (r *RecordStreak) Count() uint {
	return r.EndBlock - r.StartBlock
}

type BlocksFull struct {
	blocksFull map[int][]WatchTheBurnBlockStat
	currentStreaks map[int]*RecordStreak
	recordStreaks map[int]RecordStreak
	totalBlocks int
	latestBlock uint
}

func (b *BlocksFull) Initialize(count uint) {
	b.blocksFull = make(map[int][]WatchTheBurnBlockStat)
	b.currentStreaks = make(map[int]*RecordStreak)
	b.recordStreaks = make(map[int]RecordStreak)
	b.totalBlocks = 0
	b.latestBlock = count
}

func (b *BlocksFull) ProcessBlock(block watchtheburn.BlockStats) error {
	b.totalBlocks++

	blockstats, err := b.decodeBlockStats(block)
	if err != nil {
		return err
	}
	
	b.storePercentage(*blockstats, 90)
	b.storePercentage(*blockstats, 95)
	b.storePercentage(*blockstats, 99)

	return nil
}

func (b *BlocksFull) PrintPercentageFull(percentile int) {
	consecutivePercentile := percentile + FullConsecutiveBucket

	fullPercentiles := b.blocksFull[percentile]
	fullCount := len(fullPercentiles)
	percentageFull := float64(fullCount) / float64(b.totalBlocks) * 100

	consecutivePercentiles := b.blocksFull[consecutivePercentile]
	consecutiveCount := len(consecutivePercentiles)
	consecutiveFull := float64(consecutiveCount) / float64(b.totalBlocks) * 100

	recordStreak := b.recordStreaks[percentile]
	fmt.Printf(`
	>%d%% full:
		- %.2f%% blocks are full (%d/%d)
		- %.2f%% blocks are consecutive full 3+ (%d/%d)
		- Largest Streak (from %d to %d):
			- %d blocks
			- %.2f%% EIP-1559 transactions (%d/%d)
			- %.2f ETH rewards (%.2f ETH min, %.2f ETH max, %.2f ETH avg)
			- %.2f ETH burned (%.2f ETH min, %.2f ETH max, %.2f ETH avg)
			- %.2f ETH tips (%.2f ETH min, %.2f ETH max, %.2f ETH avg)
			- %.2f GWEI basefee (%.2f GWEI min, %.2f GWEI max, %.2f GWEI avg)
			- %.2f GWEI priorityfee (%.2f GWEI min, %.2f GWEI max, %.2f GWEI avg)
	`,	percentile, 
		percentageFull, fullCount, b.totalBlocks,
		consecutiveFull, consecutiveCount, b.totalBlocks,
		recordStreak.StartBlock, recordStreak.EndBlock,
		recordStreak.Count(),
		float64(recordStreak.TotalType2Transactions) / float64(recordStreak.TotalTransactions) * 100, recordStreak.TotalType2Transactions, recordStreak.TotalTransactions,
		b.formatEther(&recordStreak.Rewards.Total), b.formatEther(&recordStreak.Rewards.Min), b.formatEther(&recordStreak.Rewards.Max), b.formatAverageEther(&recordStreak.Rewards.Total, recordStreak.Count()),
		b.formatEther(&recordStreak.Burned.Total), b.formatEther(&recordStreak.Burned.Min), b.formatEther(&recordStreak.Burned.Max), b.formatAverageEther(&recordStreak.Burned.Total, recordStreak.Count()),
		b.formatEther(&recordStreak.Tips.Total), b.formatEther(&recordStreak.Tips.Min), b.formatEther(&recordStreak.Tips.Max), b.formatAverageEther(&recordStreak.Tips.Total, recordStreak.Count()),
		b.formatGwei(&recordStreak.BaseFee.Total), b.formatGwei(&recordStreak.BaseFee.Min), b.formatGwei(&recordStreak.BaseFee.Max), b.formatAverageGwei(&recordStreak.BaseFee.Total, recordStreak.Count()),
		b.formatGwei(&recordStreak.PriorityFee.Total), b.formatGwei(&recordStreak.PriorityFee.Min), b.formatGwei(&recordStreak.PriorityFee.Max), b.formatAverageGwei(&recordStreak.PriorityFee.Total, recordStreak.Count()),
	)
}

func (b* BlocksFull) formatAverageEther(total *big.Int, count uint) float64 {
	return  b.formatEther(total) / float64(count)
}

func (b* BlocksFull) formatAverageGwei(total *big.Int, count uint) float64 {
	return  b.formatGwei(total) / float64(count)
}

func (b *BlocksFull) formatEther(value *big.Int) float64 {
	ether, _ := new(big.Float).Quo(new(big.Float).SetInt(value), new(big.Float).SetInt(big.NewInt(params.Ether))).Float64()
	return ether
}

func (b *BlocksFull) formatGwei(value *big.Int) float64 {
	gwei, _ := new(big.Float).Quo(new(big.Float).SetInt(value), new(big.Float).SetInt(big.NewInt(params.GWei))).Float64()
	return gwei
}

func (b *BlocksFull) storePercentage(block WatchTheBurnBlockStat, percentile int) {
	trackingPercentile := percentile + FullTrackingBucket
	consecutivePercentile := percentile + FullConsecutiveBucket
	clearTrackingPercentile := false

	b.updateCurrentStreak(block, percentile)

	if block.GasUsedPercentage > float64(percentile) {
		b.blocksFull[percentile] = append(b.blocksFull[percentile], block)
		b.blocksFull[trackingPercentile] = append(b.blocksFull[trackingPercentile], block) // Track consecutive full blocks
	} else {
		clearTrackingPercentile = true
	}

	// If the block is not consecutive full, add it to the consecutive blocks to track. This will be used to determine if the block is consecutive full.
	if clearTrackingPercentile || block.Number >= b.latestBlock {
		if len(b.blocksFull[trackingPercentile]) > ConsecutiveCount {
			streakCount := b.currentStreaks[percentile].Count()
			recordStreak := b.recordStreaks[percentile]
			if streakCount > recordStreak.Count() {
				b.recordStreaks[percentile] = *b.currentStreaks[percentile]
			}
			b.blocksFull[consecutivePercentile] = append(b.blocksFull[consecutivePercentile], block) // Mark consecutive full blocks

			// fmt.Printf("%d to %d = %d\n", b.currentStreaks[percentile].StartBlock, b.currentStreaks[percentile].EndBlock, b.currentStreaks[percentile].Count())
		}

		if clearTrackingPercentile {
			b.blocksFull[trackingPercentile] = nil
		}

		b.currentStreaks[percentile] = nil
	}
}

func (b *BlocksFull) updateCurrentStreak(block WatchTheBurnBlockStat, percentile int) {
	if b.currentStreaks[percentile] == nil {
		b.currentStreaks[percentile] = &RecordStreak{
			StartBlock: block.Number,
			EndBlock: block.Number,
			BaseFee: b.initializeComplexRecord(block.BaseFee),
			Burned: b.initializeComplexRecord(block.Burned),
			PriorityFee: b.initializeComplexRecord(block.PriorityFee),
			Rewards: b.initializeComplexRecord(block.Rewards),
			Tips: b.initializeComplexRecord(block.Tips),
			TotalTransactions: uint(block.Transactions),
			TotalType2Transactions: uint(block.Type2Transactions),
		}
	} else {
		currentStreak := b.currentStreaks[percentile]
		newStreak := &RecordStreak{
			StartBlock: currentStreak.StartBlock,
			EndBlock: block.Number,
			BaseFee: b.updateComplexRecord(currentStreak.BaseFee, block.BaseFee),
			Burned: b.updateComplexRecord(currentStreak.Burned, block.Burned),
			PriorityFee: b.updateComplexRecord(currentStreak.PriorityFee, block.PriorityFee),
			Rewards: b.updateComplexRecord(currentStreak.Rewards, block.Rewards),
			Tips: b.updateComplexRecord(currentStreak.Tips, block.Tips),
			TotalTransactions: currentStreak.TotalTransactions + uint(block.Transactions),
			TotalType2Transactions: currentStreak.TotalType2Transactions + uint(block.Type2Transactions),
		}
		b.currentStreaks[percentile] = newStreak
	}
}

func (b *BlocksFull) initializeComplexRecord(value big.Int) ComplexRecord {
	return ComplexRecord{
		Total: value,
		Min: value,
		Max: value,
	}
}

func (b *BlocksFull) updateComplexRecord(complex ComplexRecord, value big.Int) ComplexRecord {
	total := big.NewInt(0)
	total.Add(total, &complex.Total)
	total.Add(total, &value)
	complex.Total = *total
	
	if complex.Min.Cmp(&value) == 1 {
		complex.Min = value
	}
	if complex.Max.Cmp(&value) == -1 {
		complex.Max = value
	}
	return complex
}

func (b *BlocksFull) decodeBlockStats(block watchtheburn.BlockStats) (*WatchTheBurnBlockStat, error) {
	baseFee, err := hexutil.DecodeBig(block.BaseFee)
	if err != nil {
		return nil, fmt.Errorf("couldn't decode BaseFee: %v", err)
	}

	burned, err := hexutil.DecodeBig(block.Burned)
	if err != nil {
		return nil, fmt.Errorf("couldn't decode Burned: %v", err)
	}

	gasTarget, err := hexutil.DecodeUint64(block.GasTarget)
	if err != nil {
		return nil, fmt.Errorf("couldn't decode GasTarget: %v", err)
	}

	gasUsed, err := hexutil.DecodeUint64(block.GasUsed)
	if err != nil {
		return nil, fmt.Errorf("couldn't decode GasUsed: %v", err)
	}

	priorityFee, err := hexutil.DecodeBig(block.PriorityFee)
	if err != nil {
		return nil, fmt.Errorf("couldn't decode PriorityFee: %v", err)
	}

	rewards, err := hexutil.DecodeBig(block.Rewards)
	if err != nil {
		return nil, fmt.Errorf("couldn't decode Rewards: %v", err)
	}

	tips, err := hexutil.DecodeBig(block.Tips)
	if err != nil {
		return nil, fmt.Errorf("couldn't decode Tips: %v", err)
	}

	transactions, err := hexutil.DecodeUint64(block.Transactions)
	if err != nil {
		return nil, fmt.Errorf("couldn't decode Transactions: %v", err)
	}

	type2Transactions, err := hexutil.DecodeUint64(block.Type2Transactions)
	if err != nil {
		return nil, fmt.Errorf("couldn't decode Type2Transactions: %v", err)
	}

	var gasUsedPercentage float64
	if gasTarget == 0 {
		gasUsedPercentage = 0.0
	} else {
		gasUsedPercentage = float64(gasUsed) / float64(gasTarget * 2) * 100
	}

	return &WatchTheBurnBlockStat{
		Number: block.Number,
		BaseFee: *baseFee,
		Burned: *burned,
		GasTarget: gasTarget,
		GasUsed: gasUsed,
		PriorityFee: *priorityFee,
		Rewards: *rewards,
		Tips: *tips,
		Transactions: transactions,
		Type2Transactions: type2Transactions,
		Timestamp: block.Timestamp,
		GasUsedPercentage: gasUsedPercentage,
	}, nil
}
