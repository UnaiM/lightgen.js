function luma(colour) {
  // Rec.709 relative luminance of a colour.
  return 0.2126*colour.r + 0.7152*colour.g + 0.0722*colour.b
}

export function mediancut(image, width, height, iterations, hemisphere) {
  // Implementation of A Median Cut Algorithm for Light Probe Sampling (Debevec 2006). Arguments:
  // - image: A typed array containing raw image data of an equirectangular environment map. Will only use first 3 channels (expecting RGB, horizontal stride).
  // - width: Width of the image in pixels.
  // - height: Height of the image in pixels.
  // - iterations: How many times the algorithm gets run. The amount of lights generated will be 2^iterations.
  // - hemisphere: Only calculate lights above ground level.
  // Returns an array with one object per light. Each object has the following structure:
  // - x, y: Pixel coordinates of the light's location in the image.
  // - r, g, b: Red, green and blue components of the light's colour, expressed as floating-point values such that (0, 0, 0) is black and (1, 1, 1) is white.
  // - sx, sy, ex, ey: Region of the image that the light represents, in pixels.

  function read(array, channels, x, y, sy) {
    // Overflow protection for summed area table reads (also helps creating the table itself).
    const result = {r: 0, g: 0, b: 0}
    if (x>=0 && y>=sy) {
      const i = channels * (Math.min(width-1, x) + width*(Math.min(height-1, y)-sy))
      result.r = array[i]
      result.g = array[i+1]
      result.b = array[i+2]
    }
    return result
  }

  function compens(y) {
    // Account for the pixel density differente along the equator/poles.
    return Math.sin(Math.PI * y / height)
  }

  // Calculate number of channels in the image.
  const channels = image.length / width / height

  // If only calculating northern hemisphere, discard any pixel entirely below the equator.
  const starty = hemisphere ? Math.floor(height / 2) : 0

  // Summed Area Table
  const sat = new Float64Array(3 * width * (height-starty))
  for (let y=starty; y<height; y++) {
    const scan = {r: 0, g: 0, b: 0}
    const weight = compens(y + 0.5)
    for (let x=0; x<width; x++) {
      const curr = read(image, channels, x, y, 0)
      const below = read(sat, 3, x, y-1, starty)
      const i = 3 * (x + width*(y-starty))
      scan.r += weight * curr.r
      scan.g += weight * curr.g
      scan.b += weight * curr.b
      sat[i] = below.r + scan.r
      sat[i+1] = below.g + scan.g
      sat[i+2] = below.b + scan.b
    }
  }

  function split(region, vert) {
    const target = luma(region) / 2

    const offset = read(sat, 3, region.sx-1, region.sy-1, starty)
    const o = read(sat, 3, vert?region.ex:(region.sx-1), vert?(region.sy-1):region.ey, starty)
    offset.r -= o.r
    offset.g -= o.g
    offset.b -= o.b

    // u is the coordinate we sweep the region along, which might be x or y depending on the region's aspect.
    for (let u=vert?region.sy:region.sx; u<=(vert?region.ey:region.ex); u++) {
      const curr = read(sat, 3, vert?region.ex:u, vert?u:region.ey, starty)
      const c = read(sat, 3, vert?(region.sx-1):u, vert?u:(region.sy-1), starty)
      curr.r += offset.r - c.r
      curr.g += offset.g - c.g
      curr.b += offset.b - c.b

      if (luma(curr) >= target) {
        u += 1
        return {sx: region.sx, sy: region.sy, ex: vert?region.ex:u, ey: vert?u:region.ey, r: curr.r, g: curr.g, b: curr.b}
      }
    }
  }

  // Initialise with a single region representing the entire image.
  let regions = [read(sat, 3, Infinity, Infinity, starty)]
  regions[0].sx = 0
  regions[0].sy = starty
  regions[0].ex = width
  regions[0].ey = height

  for (let i=0; i<iterations; i++) {
    const sub = []
    regions.forEach(region => {
      const wid = region.ex - region.sx
      const hei = region.ey - region.sy

      const vert = (hei*compens(region.sy+hei/2)) > wid

      const spl = split(region, vert)
      sub.push(spl)
      const u = vert?spl.ey:spl.ex
      if (u < (vert?region.ey:region.ex)) {
        // XXX: Why doesn't a simple subtraction work as expected?
        // sub.push({sx: vert?region.sx:u, sy: vert?u:region.sy, ex: region.ex, ey: region.ey, r: region.r-spl.r, g: region.g-spl.g, b: region.b-spl.b})
        const tr = read(sat, 3, region.ex, region.ey, starty)
        const tl = read(sat, 3, (vert?region.sx:u)-1, region.ey, starty)
        const br = read(sat, 3, region.ex, (vert?u:region.sy)-1, starty)
        const bl = read(sat, 3, (vert?region.sx:u)-1, (vert?u:region.sy)-1, starty)
        sub.push({sx: vert?region.sx:u, sy: vert?u:region.sy, ex: region.ex, ey: region.ey, r: tr.r-tl.r-br.r+bl.r, g: tr.g-tl.g-br.g+bl.g, b: tr.b-tl.b-br.b+bl.b})
      }
    })
    regions = sub
  }

  regions.forEach(region => {
    // Find centroid. Vertically splitting the horizontally splitted region yields the same results as splitting the entire region in both ways. Don't ask me why, but it doesn't work the other way around.
    const spl = split(split(region, false), true)
    region.x = spl.ex - 1
    region.y = spl.ey - 1

    region.r /= width * height
    region.g /= width * height
    region.b /= width * height
  })

  return regions
}
