/** ---------------------------------------------------------------------
 * Given two shader programs, create a complete rendering program.
 * @param gl WebGLRenderingContext The WebGL context.
 */
//
self.resetVol = function (gl) {

  gl.deleteTexture(gl.volume_texture);
  gl.deleteTexture(gl.volumeWeight_texture);
  gl.deleteTexture(gl.hp_texture);

  var volume_texture = generateTexture(gl, gl.TEXTURE_3D, gl.R32F, 1, volSize[0], volSize[1], volSize[2], gl.NEAREST, gl.NEAREST);
  var volumeWeight_texture = generateTexture(gl, gl.TEXTURE_3D, gl.R32F, 1, volSize[0], volSize[1], volSize[2], gl.NEAREST, gl.NEAREST);

  gl.volume_texture = volume_texture;      
  gl.volumeWeight_texture = volumeWeight_texture;

  let levelsHP = Math.log2(volSize[0]) + 1;
  var textureHistoPyramid = generateTexture(gl, gl.TEXTURE_3D, gl.R32UI, levelsHP, volSize[0], volSize[0], volSize[0], gl.NEAREST, gl.NEAREST_MIPMAP_NEAREST);

  gl.hp_texture = textureHistoPyramid;      
  gl.levelsHP = levelsHP;

  };