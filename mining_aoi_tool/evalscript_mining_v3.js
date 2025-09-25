//VERSION=3
function setup() {
  return {
    input: [{"bands":["B04","B08","B11","dataMask"]}],
    output: {bands:4, sampleType:"FLOAT32"}
  };
}
function evaluatePixel(sample) {
  return [sample.B04, sample.B08, sample.B11, sample.dataMask];
}


