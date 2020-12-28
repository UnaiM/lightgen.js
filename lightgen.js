export function mediancut(image, width, height, iterations) {
  // Implementation of A Median Cut Algorithm for Light Probe Sampling (Debevec 2006). Arguments:
  // - image: A typed array containing raw image data of an equirectangular environment map. Will only use first 3 channels (expecting RGB, horizontal stride).
  // - width: Width of the image in pixels.
  // - height: Height of the image in pixels.
  // - iterations: How many times the algorithm gets run. The amount of lights generated will be 2^iterations.
  // Returns an array with one object per light. Each object has the following structure:
  // - x, y: Pixel coordinates of the light's location in the image.
  // - r, g, b: Red, green and blue components of the light's colour, expressed as floating-point values such that (0, 0, 0) is black and (1, 1, 1) is white.
  // - sx, sy, ex, ey: Region of the image that the light represents, in pixels.

  const channels = image.length / width / height
  let regions = [{sx: 0, sy: 0, ex: width, ey: height, x: null, y: width/2, r: Infinity, g: Infinity, b: Infinity}]
  for (let i=0; i<=iterations; i++) {
    const sub = []
    regions.forEach(r => {
      const wid = r.ex - r.sx
      const hei = r.ey - r.sy
      if (r.x!== null && wid==1 && hei==1) {
        sub.push(r)
        return
      }
      const vert = (hei*compens(r.sy+hei/2)) > wid
      const target = luminance(r) * width * height / 2
      const light = {x: null, y: null, r: 0, g: 0, b: 0}
      const startu = vert ? r.sy : r.sx
      let lum = 0
      let maxl = 0
      let u = startu
      for (u; u<(vert?r.ey:r.ex); u++) {
        const col = {r: 0, g: 0, b: 0}
        let subl = 0
        let subv = null
        for (let v=vert?r.sx:r.sy; v<(vert?r.ex:r.ey); v++) {
          const c = read(vert?v:u, vert?u:v)
          col.r += c.r
          col.g += c.g
          col.b += c.b
          const l = luminance(c)
          lum += l
          if (l > subl) {
            subl = l
            subv = v
          }
        }
        if (lum<target || u==startu) {
          light.r += col.r
          light.g += col.g
          light.b += col.b
          if (subl > maxl) {
            maxl = subl
            light.x = vert ? subv : u
            light.y = vert ? u : subv
          }
        }
        if (lum >= target) {
          if (u == startu) {
            u += 1
          }
          break
        }
      }
      sub.push({sx: r.sx, sy: r.sy, ex: vert?r.ex:u, ey: vert?u:r.ey, x: light.x, y: light.y, r: light.r/width/height, g: light.g/width/height, b: light.b/width/height})
      if (r.x !== null) {
        if (light.x==r.x && light.y==r.y) {
          maxl = 0
          for (let x=vert?r.sx:u; x<r.ex; x++) {
            for (let y=vert?u:r.sy; y<r.ey; y++) {
              const l = luminance(read(x, y))
              if (l > maxl) {
                maxl = l
                light.x = x
                light.y = y
              }
            }
          }
        } else {
          light.x = r.x
          light.y = r.y
        }
        sub.push({sx: vert?r.sx:u, sy: vert?u:r.sy, ex: r.ex, ey: r.ey, x: light.x, y: light.y, r: r.r-light.r/width/height, g: r.g-light.g/width/height, b: r.b-light.b/width/height})
      }
    })
    regions = sub
  }
  return regions

  function compens(y) {
    return Math.sin(Math.PI * y / height)
  }

  function read(x, y) {
    const p = channels * (x + width*y)
    const w = compens(y)
    return {r: w*image[p], g: w*image[p+1], b: w*image[p+2]}
  }
}

function luminance(c) {
  // https://en.wikipedia.org/wiki/Relative_luminance
  return 0.2126*c.r + 0.7152*c.g + 0.0722*c.b
}
