// Test dosyası - Context Preview Demo

function calculateSum(a, b) {
  console.log('YENİ toplama fonksiyonu');
  return a + b; // Direkt return
  // YENI: Context preview testi
}

function multiplyNumbers(a, b) {
  console.log('GÜNCEL çarpma fonksiyonu');
  return a * b; // Optimize edildi
}


export { calculateSum, multiplyNumbers, calculateDifference };
