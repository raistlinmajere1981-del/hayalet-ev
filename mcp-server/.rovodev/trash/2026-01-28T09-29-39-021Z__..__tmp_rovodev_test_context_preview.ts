// Test dosyası - Context Preview için

function oldFunction() {
  console.log('Bu eski fonksiyon');
  const x = 1;
  const y = 2;
  return x + y;
}

function anotherFunction() {
  console.log('Başka bir fonksiyon');
  return 42;
}

function yetAnotherFunction() {
  console.log('Daha başka bir fonksiyon');
  return 100;
}

export { oldFunction, anotherFunction, yetAnotherFunction };
