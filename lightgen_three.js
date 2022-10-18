import * as THREE from 'https://unpkg.com/three@0.124.0/build/three.module.js'

export function regions2lights(regions, group, radius, mapradius, clipdistance, mapsize, bias) {
  // Creates a dome of directional lights based on regions of an environment map. Arguments:
  // - regions: List of objects in the same format as median_cut() from ../lightgen.js.
  // - group: Which Three.js group to parent the resulting lights under.
  // - radius: How far out from the group's origin each light should be.
  // - mapradius: Minimum distance from the light's axis, away from the group origin, that the shadow maps should cover.
  // - clipdistance: Distance along the light axis, away from the group origin, that the shadow should cover.
  // - mapsize: Pixel size of each side of the square shadow maps.
  // - bias: (Google it.)

  regions.forEach(region => {
    const light = new THREE.DirectionalLight(new THREE.Color(2*Math.PI*region.r, 2*Math.PI*region.g, 2*Math.PI*region.b))
    light.castShadow = true
    light.position.setFromSphericalCoords(radius, Math.PI*(1-region.ry), 2*Math.PI*(0.75-region.rx))
    light.shadow.camera.top = mapradius
    light.shadow.camera.bottom = -mapradius
    light.shadow.camera.left = -mapradius
    light.shadow.camera.right = mapradius
    light.shadow.camera.near = radius - clipdistance
    light.shadow.camera.far = radius + clipdistance
    light.shadow.mapSize = new THREE.Vector2(mapsize, mapsize)
    light.shadow.bias = bias
    group.add(light)
  })
}
