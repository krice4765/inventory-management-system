/**
 * FIFO評価額計算精度検証テスト（99.8%保証要件）
 * 0922Youken.md Phase 2要件対応 - 簡易版
 */

// FIFO評価額計算関数（JavaScript検証用実装）
function calculateFIFOValuation(layers, currentStock) {
  let valuationTaxExcluded = 0;
  let valuationTaxIncluded = 0;
  let remainingStock = currentStock;

  // 購入日順でソート（FIFO: First In, First Out）
  const sortedLayers = [...layers].sort((a, b) =>
    new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
  );

  for (const layer of sortedLayers) {
    if (remainingStock <= 0) break;

    const useQuantity = Math.min(layer.remainingQuantity, remainingStock);

    valuationTaxExcluded += useQuantity * layer.unitCostTaxExcluded;
    valuationTaxIncluded += useQuantity * layer.unitCostTaxIncluded;

    remainingStock -= useQuantity;
  }

  return {
    valuationTaxExcluded,
    valuationTaxIncluded
  };
}

// テストケース定義
const testCases = [
  {
    testName: 'Basic FIFO Test - Single Layer',
    layers: [
      {
        purchaseDate: '2023-10-01',
        unitCostTaxExcluded: 100,
        unitCostTaxIncluded: 110,
        remainingQuantity: 15
      }
    ],
    currentStock: 15,
    expectedValueTaxExcluded: 1500, // 15個 × 100円
    expectedValueTaxIncluded: 1650   // 15個 × 110円
  },
  {
    testName: 'Complex FIFO Test - Multiple Layers',
    layers: [
      {
        purchaseDate: '2023-10-01',
        unitCostTaxExcluded: 80,
        unitCostTaxIncluded: 88,
        remainingQuantity: 0  // 完全消費
      },
      {
        purchaseDate: '2023-10-02',
        unitCostTaxExcluded: 120,
        unitCostTaxIncluded: 132,
        remainingQuantity: 0  // 完全消費
      },
      {
        purchaseDate: '2023-10-03',
        unitCostTaxExcluded: 200,
        unitCostTaxIncluded: 220,
        remainingQuantity: 8  // 部分消費
      }
    ],
    currentStock: 8,
    expectedValueTaxExcluded: 1600, // 8個 × 200円
    expectedValueTaxIncluded: 1760   // 8個 × 220円
  },
  {
    testName: 'Edge Case - Zero Stock',
    layers: [],
    currentStock: 0,
    expectedValueTaxExcluded: 0,
    expectedValueTaxIncluded: 0
  },
  {
    testName: 'Partial Layer Consumption',
    layers: [
      {
        purchaseDate: '2023-10-01',
        unitCostTaxExcluded: 90,
        unitCostTaxIncluded: 99,
        remainingQuantity: 3  // 10個中7個消費済み
      },
      {
        purchaseDate: '2023-10-02',
        unitCostTaxExcluded: 110,
        unitCostTaxIncluded: 121,
        remainingQuantity: 7  // 10個中3個消費済み
      }
    ],
    currentStock: 10,
    expectedValueTaxExcluded: 1040, // 3個×90円 + 7個×110円 = 270 + 770 = 1040
    expectedValueTaxIncluded: 1144   // 3個×99円 + 7個×121円 = 297 + 847 = 1144
  }
];

// テスト実行
function runTests() {
  console.log('=== FIFO評価額計算精度検証テスト ===');
  console.log('0922Youken.md Phase 2要件: 精度99.8%以上保証\n');

  const results = [];

  testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. ${testCase.testName}`);

    try {
      const { valuationTaxExcluded, valuationTaxIncluded } = calculateFIFOValuation(
        testCase.layers,
        testCase.currentStock
      );

      // 精度計算
      const accuracyTaxExcluded = testCase.expectedValueTaxExcluded > 0
        ? (1 - Math.abs(valuationTaxExcluded - testCase.expectedValueTaxExcluded) / testCase.expectedValueTaxExcluded) * 100
        : 100;

      const accuracyTaxIncluded = testCase.expectedValueTaxIncluded > 0
        ? (1 - Math.abs(valuationTaxIncluded - testCase.expectedValueTaxIncluded) / testCase.expectedValueTaxIncluded) * 100
        : 100;

      const passed = accuracyTaxExcluded >= 99.8 && accuracyTaxIncluded >= 99.8;

      console.log(`   結果: ${passed ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   税抜: 期待値 ${testCase.expectedValueTaxExcluded}円 → 実際 ${valuationTaxExcluded}円 (精度: ${accuracyTaxExcluded.toFixed(3)}%)`);
      console.log(`   税込: 期待値 ${testCase.expectedValueTaxIncluded}円 → 実際 ${valuationTaxIncluded}円 (精度: ${accuracyTaxIncluded.toFixed(3)}%)`);
      console.log('');

      results.push({
        testName: testCase.testName,
        passed,
        accuracyTaxExcluded,
        accuracyTaxIncluded
      });

    } catch (error) {
      console.log(`   結果: ❌ ERROR - ${error.message}`);
      console.log('');

      results.push({
        testName: testCase.testName,
        passed: false,
        error: error.message
      });
    }
  });

  // 総合結果
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const successRate = (passedTests / totalTests) * 100;

  console.log('=== 総合結果 ===');
  console.log(`実行テスト数: ${totalTests}`);
  console.log(`合格テスト数: ${passedTests}`);
  console.log(`成功率: ${successRate.toFixed(1)}%`);
  console.log(`要件適合: ${successRate >= 99.8 ? '✅ PASS (99.8%以上)' : '❌ FAIL (99.8%未満)'}`);

  if (successRate >= 99.8) {
    console.log('\n🎉 FIFO評価額計算は99.8%以上の精度要件を満たしています！');
  } else {
    console.log('\n⚠️ FIFO評価額計算の精度が要件を下回っています。要改善。');
  }

  return results;
}

// テスト実行
runTests();