function integrateVolume(gl, _iFlag, _rFlag) {

    gl.useProgram(integrateProg);

    let invPose = glMatrix.mat4.create();
    glMatrix.mat4.invert(invPose, pose);

    gl.uniform4fv(gl.getUniformLocation(integrateProg, "cam"), camPam);
    gl.uniformMatrix4fv(gl.getUniformLocation(integrateProg, "invT"), false, invPose);

    gl.uniform1i(gl.getUniformLocation(integrateProg, "integrateFlag"), _iFlag);
    gl.uniform1i(gl.getUniformLocation(integrateProg, "resetFlag"), _rFlag);

    gl.uniform1i(gl.getUniformLocation(integrateProg, "p2p"), 1);
    gl.uniform1i(gl.getUniformLocation(integrateProg, "p2v"), 0);

    gl.uniform1f(gl.getUniformLocation(integrateProg, "maxWeight"), 100.0);
    gl.uniform1f(gl.getUniformLocation(integrateProg, "volDim"), volLength);
    gl.uniform1f(gl.getUniformLocation(integrateProg, "volSize"), volSize[0]);


    // textures
    gl.bindImageTexture(0, gl.volume_texture, 0, false, 0, gl.READ_WRITE, gl.R32F);
    gl.bindImageTexture(1, gl.volumeWeight_texture, 0, false, 0, gl.READ_WRITE, gl.R32F);

    gl.bindImageTexture(2, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(3, gl.render_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);
    gl.bindImageTexture(4, gl.normal_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);

    gl.dispatchCompute(volSize[0] / 32, volSize[1] / 32, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

    if (resetFlag == 1)
    {
      resetFlag = 0;
      integrateFlag = 1;
    }

}

function raycastVolume(gl, width, height) {

    gl.useProgram(raycastProg);

    gl.bindImageTexture(0, gl.volume_texture, 0, false, 0, gl.READ_ONLY, gl.R32F);
    gl.bindImageTexture(1, gl.refVertex_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
    gl.bindImageTexture(2, gl.refNormal_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
    
    let view = glMatrix.mat4.create();
    glMatrix.mat4.mul(view, pose, invK);

    let dMin = -volLength / 20.0;
    let dMax = volLength / 10.0;

    let step = volLength / volSize[0];

    gl.uniformMatrix4fv(gl.getUniformLocation(raycastProg, "view"), false, view);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "step"), step);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "largeStep"), 0.5 * 0.75);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "nearPlane"), 0.01);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "farPlane"), 3.0);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "volDim"), volLength);
    gl.uniform1f(gl.getUniformLocation(raycastProg, "volSize"), volSize[0]);

    gl.dispatchCompute(width / 32, height / 32, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

}

function classifyCubes(gl) {
  gl.useProgram(constructHistoPyramidProgram);
  // since we have large volumes, and GPU memory isnt infinite, we pack the number of triangles and the cubeIndex into 
  // a single float32 in the hpbaselevel. The levels above will just count the number of triangles.

  gl.uniform1i(gl.getUniformLocation(constructHistoPyramidProgram, "functionID"), 0);
  gl.uniform1f(gl.getUniformLocation(constructHistoPyramidProgram, "isoLevel"), 0);

  gl.uniform1i(gl.getUniformLocation(constructHistoPyramidProgram, "volumeFloatTexture"), 1);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_3D, gl.volume_texture);

  gl.bindImageTexture(1, gl.hp_texture, 0, true, 0, gl.WRITE_ONLY, gl.R32UI);
  gl.bindImageTexture(2, gl.nrTriangles_texture, 0, false, 0, gl.READ_ONLY, gl.R32UI);

  gl.dispatchCompute(divup(volSize[0], 8), divup(volSize[1], 8), divup(volSize[2], 8));
  gl.memoryBarrier(gl.ALL_BARRIER_BITS);

}



function constructHistoPyramid(gl) {

  for (let i = 0; i < (gl.levelsHP - 1); i++)
  {
      gl.useProgram(constructHistoPyramidProgram);

      gl.bindImageTexture(1, gl.hp_texture, i + 1, true, 0, gl.WRITE_ONLY, gl.R32UI)

      gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboHPSum);

      gl.uniform1i(gl.getUniformLocation(constructHistoPyramidProgram, "functionID"), 1);
      gl.uniform1i(gl.getUniformLocation(constructHistoPyramidProgram, "hpLevel"), i);
      gl.uniform1i(gl.getUniformLocation(constructHistoPyramidProgram, "maxLevel"), gl.levelsHP - 2);

      gl.uniform1i(gl.getUniformLocation(constructHistoPyramidProgram, "histoPyramidTexture"), 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, gl.hp_texture);

      let csize = divup(volSize[0] >> (i + 1), 8);
      gl.dispatchCompute(csize, csize, csize);
      gl.memoryBarrier(gl.ALL_BARRIER_BITS);
  }


  const outData = new Uint32Array(1);
  gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboHPSum);
  gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, outData);
  //console.log(outData);
  gl.memoryBarrier(gl.ALL_BARRIER_BITS);

  gl.totalSumVerts = outData * 3;
  if (outData > 0)
  {
      gl.totalSumTrianglesToRender = outData;
      gl.blankCounter = 0;
  }
  else {
      gl.blankCounter++;
      console.log(gl.blankCounter);

      if (gl.blankCounter > 100)
      {
          gl.blankCounter = 0;
          return;
      }
      constructHistoPyramid(gl);
  }
}

function traverseHistoPyramid(gl) {

  if (gl.totalSumVerts > 0)
  {
      gl.useProgram(traverseHistoPyramidProgram);

      gl.uniform1i(gl.getUniformLocation(traverseHistoPyramidProgram, "histoPyramidTexture"), 0);
      gl.uniform1i(gl.getUniformLocation(traverseHistoPyramidProgram, "volumeFloatTexture"), 1);
      //gl.uniform1i(gl.getUniformLocation(gl.traverseHistoPyramidProgram, "triTable"), 2);
      //gl.uniform1i(gl.getUniformLocation(gl.traverseHistoPyramidProgram, "offsets3"), 3);
  
      // gl.uniform2fv(gl.getUniformLocation(gl.traverseHistoPyramidProgram, "scaleVec"), [128.0, 384.0]);
      gl.uniform1ui(gl.getUniformLocation(traverseHistoPyramidProgram, "totalSum"), (gl.totalSumVerts / 3));
      gl.uniform1f(gl.getUniformLocation(traverseHistoPyramidProgram, "isoLevel"), 0);
      //gl.uniform3fv(gl.getUniformLocation(gl.traverseHistoPyramidProgram, "pixDims"), gl.pixDims);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, gl.hp_texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, gl.volume_texture);
  
      gl.bindImageTexture(0, gl.triTable_texture, 0, false, 0, gl.READ_ONLY, gl.R32UI);
      gl.bindImageTexture(1, gl.offsets3_texture, 0, false, 0, gl.READ_ONLY, gl.R32UI);
  
      // gl.activeTexture(gl.TEXTURE2);
      // gl.bindTexture(gl.TEXTURE_2D, gl.textureTriTable);
      // gl.activeTexture(gl.TEXTURE3);
      // gl.bindTexture(gl.TEXTURE_2D, gl.textureOffsets3);
  
      gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboHPVerts);
      //gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboHPNorms);
  
      gl.dispatchCompute(divup(gl.totalSumVerts / 3, 8), 1, 1);
      gl.memoryBarrier(gl.ALL_BARRIER_BITS);
  }




  //const outData = new Float32Array(512*128*128*4);
 // gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboHPVerts);
  //gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, outData);
}

function getIsoSurface(gl) {
  classifyCubes(gl);
  constructHistoPyramid(gl);
  traverseHistoPyramid(gl);
}

