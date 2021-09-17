
module.exports.chunks = function* (arr, n) {
  for (let i = 0, l = arr.length; i < l; i += n) {
    yield arr.slice(i, i + n);
  }
}

/**
 * finds differences in two arrays
 * assumes arrays to be sorted
 * returns array of entries in a and entries in b
 */
module.exports.findDifferences = function (a, b) {
  let indexA = 0, indexB = 0;
  const lengthA = a.length, lengthB = b.length;
  const diff  = [[], []];
  while (indexA < lengthA && indexB < lengthB) {
    const currentA = a[indexA];
    const currentB = b[indexB];
    if (currentA < currentB) {
      indexA++;
      diff[0].push(currentA);
    } else if(currentA > currentB) {
      indexB++;
      diff[1].push(currentB);
    } else {
      indexA++;
      indexB++;
    }
  }
  while (indexA < lengthA) {
    diff[0].push(a[indexA]);
    indexA++;
  }
  while (indexB < lengthB) {
    diff[1].push(b[indexB]);
    indexB++;
  }
  return diff;
}
