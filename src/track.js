function resultToMatrix(_result, _delta)
{
  // from https://github.com/g-truc/glm/tree/master/glm/gtx/euler_angles.inl
  let c1 = Math.cos(-_result[3]);
  let c2 = Math.cos(-_result[4]);
  let c3 = Math.cos(-_result[5]);
  let s1 = Math.sin(-_result[3]);
  let s2 = Math.sin(-_result[4]);
  let s3 = Math.sin(-_result[5]);
  
  _delta[0] = c2 * c3;
  _delta[1] =-c1 * s3 + s1 * s2 * c3;
  _delta[2] = s1 * s3 + c1 * s2 * c3;
  _delta[3] = 0;
  _delta[4] = c2 * s3;
  _delta[5] = c1 * c3 + s1 * s2 * s3;
  _delta[6] =-s1 * c3 + c1 * s2 * s3;
  _delta[7] = 0;
  _delta[8] =-s2;
  _delta[9] = s1 * c2;
  _delta[10] = c1 * c2;
  _delta[11] = 0;
  _delta[12] = _result[0];
  _delta[13] = _result[1];
  _delta[14] = _result[2];
  _delta[15] = 1;
}

function resultToMatrixSO3(_result, _delta) {
	let rx, ry, rz, theta;

	rx = _result[0];
	ry = _result[1];
  rz = _result[2];
    
	theta = glMatrix.vec3.length(_result);

	if (theta >= 2.2204460492503131e-016)
	{
		let I = glMatrix.mat3.create();

		let c = Math.cos(theta);
		let s = Math.sin(theta);
		let c1 = 1.0 - c;
		let itheta = theta ? 1.0 / theta : 0.0;

		rx *= itheta; ry *= itheta; rz *= itheta;

		let rrt = glMatrix.mat3.fromValues( rx*rx, rx*ry, rx*rz, rx*ry, ry*ry, ry*rz, rx*rz, ry*rz, rz*rz );
		let _r_x_ = glMatrix.mat3.fromValues( 0, -rz, ry, rz, 0, -rx, -ry, rx, 0 );
		let R = glMatrix.mat3.create();

		for (let k = 0; k < 9; k++)
		{
			_delta[k] = c * I[k] + c1 * rrt[k] + s * _r_x_[k];
		}
	}
}

function computeUpdateSE3(result, delta) {

  let rvec = glMatrix.vec3.fromValues(result[3], result[4], result[5]);
  let R = glMatrix.mat3.create();

  resultToMatrixSO3(rvec, R);

  glMatrix.mat4.set(delta, R[0], R[1], R[2], 0, 
                              R[3], R[4], R[5], 0,
                              R[6], R[7], R[8], 0,
                              result[0], result[1], result[2], 1);
}

function twistMatrix(_result) {
  let sqrMat = [[0.0, _result[2], _result[1], _result[3]],
             [_result[2], 0.0, _result[0], _result[4]],
             [-_result[1], _result[1], 0.0, _result[5]],
             [0.0, 0.0, 0.0, 0.0]];
  return sqrMat;
}

function twist(xi) {

  var M = [
    [0.0,    xi[2], -xi[1], 0.0], 
    [-xi[2],  0.0,    xi[0], 0.0],
    [xi[1], -xi[0],  0.0,   0.0],
    [xi[3],  xi[4],  xi[5], 0.0]
  ];
  return M;
}

function solve(_A, _b, _result) {
  let A = Array.from(_A);
  let b = Array.from(_b);
  let folded_A = luqr.fold(A, 6);
  let res = Array(6);
  res = luqr.solve(folded_A,b);
  if (res != null)
  {
    for (let i = 0; i < res.length; i++)
    {
      _result[i] = res[i];
    }
  }
}

function getReduction(gl, _A, _b, _icpData) {

    const outputReductionData = new Float32Array(8 * 32);
    gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboReductionOutput);
    gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, outputReductionData);
    for (let row = 1; row < 8; row++) {
        for (let col = 0; col < 32; col++) {
            outputReductionData[col + 0 * 32] += outputReductionData[col + row * 32];
        }
    }
  /*
  vector b
  | 1 |
  | 2 |
  | 3 |
  | 4 |
  | 5 |
  | 6 |
  and
  matrix a
  | 7  | 8  | 9  | 10 | 11 | 12 |
  | 8  | 13 | 14 | 15 | 16 | 17 |
  | 9  | 14 | 18 | 19 | 20 | 21 |
  | 10 | 15 | 19 | 22 | 23 | 24 |
  | 11 | 16 | 20 | 23 | 25 | 26 |
  | 12 | 17 | 21 | 24 | 26 | 27 |
  AE = sqrt( [0] / [28] )
  count = [28]
  */
    for (let i = 1; i <= 6; i++) {
        _b[i - 1] = outputReductionData[i];
    }
    var shift = 7;
    for (let i = 0; i < 6; ++i) {
        for (let j = i; j < 6; ++j) {
            let value = outputReductionData[shift++];
            _A[j * 6 + i] = _A[i * 6 + j] = value;
        }
    }
    _icpData.AE = Math.sqrt(outputReductionData[0] / outputReductionData[28]);
    _icpData.icpCount = outputReductionData[28];
}

function reduceP2P(gl) {
    gl.useProgram(p2pReduceProg);
    gl.uniform2fv(gl.getUniformLocation(p2pReduceProg, "imSize"), imageSize);
    // buffers
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReduction);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboReductionOutput);
    gl.dispatchCompute(8, 1, 1);
    gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);
}

function trackP2P(gl, width, height, _T, _level) {
    gl.useProgram(p2pTrackProg);
    let projRef = glMatrix.mat4.create();
    let invPose = glMatrix.mat4.create();
    glMatrix.mat4.invert(invPose, pose);
    glMatrix.mat4.mul(projRef, K, invPose);
    // buffers
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReduction);
    // uniforms 
    gl.uniformMatrix4fv(gl.getUniformLocation(p2pTrackProg, "T"), false, _T);
    gl.uniformMatrix4fv(gl.getUniformLocation(p2pTrackProg, "view"), false, projRef);
    gl.uniform1f(gl.getUniformLocation(p2pTrackProg, "distThresh"), 0.01);
    gl.uniform1f(gl.getUniformLocation(p2pTrackProg, "normThresh"), 0.9);
    gl.uniform1i(gl.getUniformLocation(p2pTrackProg, "mip"), _level);
    gl.uniform4fv(gl.getUniformLocation(p2pTrackProg, "cam"), camPam);
    // textures
    gl.bindImageTexture(0, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(1, gl.normal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(2, gl.refVertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(3, gl.refNormal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(4, gl.render_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA8UI);
    gl.dispatchCompute(width / 32, height / 32, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);
}

function reduceP2V(gl) {
    gl.useProgram(p2vReduceProg);
    gl.uniform2fv(gl.getUniformLocation(p2vReduceProg, "imSize"), imageSize);
    // buffers
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReduction);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboReductionOutput);
    gl.dispatchCompute(8, 1, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);
}

function trackP2V(gl, width, height, _T, _level) {
    gl.useProgram(p2vTrackProg);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReduction);

    gl.uniform1i(gl.getUniformLocation(p2vTrackProg, "volumeDataTexture"), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, gl.volume_texture);

    gl.bindImageTexture(0, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(1, gl.normal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(2, gl.refNormal_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA32F);
    gl.bindImageTexture(3, gl.render_texture, 0, false, 0, gl.WRITE_ONLY, gl.RGBA8UI);

    gl.uniformMatrix4fv(gl.getUniformLocation(p2vTrackProg, "T"), false, _T);
    gl.uniform1f(gl.getUniformLocation(p2vTrackProg, "volDim"), volLength);
    gl.uniform1f(gl.getUniformLocation(p2vTrackProg, "volSize"), volSize[0]);
    gl.uniform1i(gl.getUniformLocation(p2vTrackProg, "mip"), _level);
    gl.dispatchCompute(width / 32, height / 32, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);
}


function calcPoseP2P(gl, width, height) {

    if (resetFlag == 0) {
      generateVertNorms(gl, width, height);
      raycastVolume(gl, width, height);
      
      // var T = glMatrix.mat4.create();

      // T = [...pose];
      // var level = 0;

      // var A = new Float32Array(36); // 6 * 6
      // var b = new Float32Array(6);
      // var result = new Float32Array(6);
      // var icpData = {AE:0.0, icpCount:0};

      // // use proper lvls ....
      // for (let i = 0; i < 2; i++)
      // {
      //   var delta = glMatrix.mat4.create();
      //   trackP2P(gl, width, height, T, level);
      //   reduceP2P(gl);
      //   getReduction(gl, A, b, icpData);
      //   solve(A, b, result);
      //   resultToMatrix(result, delta);

      //   glMatrix.mat4.mul(T, delta, T);
      // }
      // pose = [...T];
    }
    else {
      getClickedPoint(gl);
    }
    
    integrateVolume(gl, integrateFlag, resetFlag);
  }



  function calcPoseP2V(gl, width, height) {

    if (resetFlag == 0) {
      generateVertNorms(gl, width, height);


      var T = glMatrix.mat4.clone(pose);
      var level = 0;

      var A = new Float32Array(36); // 6 * 6
      var b = new Float32Array(6);
      var result = new Float32Array(6);
      var resultPrev = new Float32Array(6);

      var icpData = {AE:0.0, icpCount:0};

      var tracked = false;



      for (let i = 0; i < 2; i++)
      {

        var twistedResult = twist(result);
        let tempTmat = math.expm(twistedResult);

        let tempTtemp = glMatrix.mat4.fromValues(tempTmat.get([0,0]), tempTmat.get([0,1]), tempTmat.get([0,2]), tempTmat.get([0,3]),
                                             tempTmat.get([1,0]), tempTmat.get([1,1]), tempTmat.get([1,2]), tempTmat.get([1,3]),
                                             tempTmat.get([2,0]), tempTmat.get([2,1]), tempTmat.get([2,2]), tempTmat.get([2,3]),
                                             tempTmat.get([3,0]), tempTmat.get([3,1]), tempTmat.get([3,2]), tempTmat.get([3,3])
          );
        
          let currT = glMatrix.mat4.create();
          glMatrix.mat4.multiply(currT, tempTtemp, T);    

        trackP2V(gl, width, height, currT, level);
        reduceP2V(gl);
        getReduction(gl, A, b, icpData);

        //console.log(icpData);

        let scaling = 1.0 / (Math.max(...A) > 0.0 ? Math.max(...A) : 1.0);

        for (let iter = 0; iter < 36; iter++) A[iter] *= scaling;
        for (let iter = 0; iter < 6; iter++) b[iter] *= scaling;

        //A = A + (i) <-- need to use some mathjs matrix multiplacation stuff here since A is 6x6

        var deltaResult = new Float32Array(6);

        solve(A, b, deltaResult);
        var change = [0, 0, 0, 0, 0, 0];

        for (let iter = 0; iter < 6; iter++) result[iter] -= deltaResult[iter];
        for (let iter = 0; iter < 6; iter++) change[iter] = result[iter] - deltaResult[iter];

        var Cnorm = math.norm(change);

        resultPrev = result;

        if (Cnorm < 1e-4 && icpData.AE != 0.0) {
          tracked = true;
          break;
        }
        else {
          tracked = false;
        }

        // this._resultToMatrix(result, delta);
        // glMatrix.mat4.mul(T, delta, T);
      }

      let tr = twist(result);
        let trmat = math.expm(tr);

        let temptrmat = glMatrix.mat4.fromValues(
        trmat.get([0,0]), trmat.get([0,1]), trmat.get([0,2]), trmat.get([0,3]),
        trmat.get([1,0]), trmat.get([1,1]), trmat.get([1,2]), trmat.get([1,3]),
        trmat.get([2,0]), trmat.get([2,1]), trmat.get([2,2]), trmat.get([2,3]),
        trmat.get([3,0]), trmat.get([3,1]), trmat.get([3,2]), trmat.get([3,3])
          );

          glMatrix.mat4.multiply(pose, temptrmat, T);


    }
    else {
      getClickedPoint(gl);
    }
    integrateVolume(gl, integrateFlag, resetFlag);
  }




  function genIndexMap(gl, invT) {

    gl.useProgram(indexMapGenProg);

    gl.enable(gl.DEPTH_TEST);

    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.indexMapFBO);
    gl.clearColor(-1.0, -1.0, -1.0, -1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    let w = imageSize[0] * 4;
    let h = imageSize[1] * 4;
    gl.viewport(0, 0, w, h);


    gl.uniformMatrix4fv(gl.getUniformLocation(indexMapGenProg, "invT"), false, invT);
    //gl.uniformMatrix4fv(gl.getUniformLocation(indexMapGenProg, "P"), false, matP); // calibrated persepective
    gl.uniform2fv(gl.getUniformLocation(indexMapGenProg, "imSize"), imageSize);
    gl.uniform4fv(gl.getUniformLocation(indexMapGenProg, "cam"), camPam);
    gl.uniform1f(gl.getUniformLocation(indexMapGenProg, "maxDepth"), maxDepth); // SET ME PROPERLY


    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboGlobalMap[gl.buffSwitch]);

    gl.drawArrays(gl.POINTS, 0, gl.mapSize[0]); // this needs to be the number of points in the map
    //gl.drawArrays(gl.POINTS, 0, 848*480);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    //gl.disable(gl.DEPTH_TEST);

  }

  function updateGlobalMap(gl, T) {

    let invT = glMatrix.mat4.create();
    glMatrix.mat4.invert(invT, T);

    gl.useProgram(updateGlobalMapProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(updateGlobalMapProg, "T"), false, T);
    gl.uniformMatrix4fv(gl.getUniformLocation(updateGlobalMapProg, "invT"), false, invT);
    gl.uniform1i(gl.getUniformLocation(updateGlobalMapProg, "timestamp"), gl.frameCounter);
    gl.uniform1i(gl.getUniformLocation(updateGlobalMapProg, "firstFrame"), gl.firstFrame);
    gl.uniform1f(gl.getUniformLocation(updateGlobalMapProg, "sigma"), 0.6);
    gl.uniform1f(gl.getUniformLocation(updateGlobalMapProg, "c_stable"), gl.cStable);
    gl.uniformMatrix4fv(gl.getUniformLocation(updateGlobalMapProg, "K"), false, K);
    gl.uniform1ui(gl.getUniformLocation(updateGlobalMapProg, "maxMapSize"), 5000000);


    gl.bindImageTexture(0, gl.indexMap_texture, 0, false, 0, gl.READ_ONLY, gl.R32F);
    gl.bindImageTexture(1, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(2, gl.normal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(3, gl.colorAligned_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);



    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, gl.atomicGMCounter[gl.buffSwitch]);
    gl.bufferSubData(gl.ATOMIC_COUNTER_BUFFER, 0, gl.mapSize);
    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, null);

    gl.bindBufferBase(gl.ATOMIC_COUNTER_BUFFER, 0, gl.atomicGMCounter[gl.buffSwitch]);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboGlobalMap[gl.buffSwitch]);

    gl.dispatchCompute(divup(imageSize[0], 32), divup(imageSize[1], 32), 1);
    gl.memoryBarrier(gl.ATOMIC_COUNTER_BARRIER_BIT);




    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, gl.atomicGMCounter[gl.buffSwitch]);
    gl.getBufferSubData(gl.ATOMIC_COUNTER_BUFFER, 0, gl.mapSize);
    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, null);

    //console.log(gl.mapSize[0]);


  }

  function removeUnnecessaryPoints(gl) {

    gl.useProgram(removeUnnecessaryPointsProg);

    let buffs = [gl.buffSwitch, 1 - gl.buffSwitch];

    gl.uniform1i(gl.getUniformLocation(removeUnnecessaryPointsProg, "timestamp"), gl.frameCounter);
    gl.uniform1f(gl.getUniformLocation(removeUnnecessaryPointsProg, "c_stable"), gl.cStable);

    let blankData = new Uint32Array(1);
    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, gl.atomicGMCounter[buffs[1]]);
    gl.bufferSubData(gl.ATOMIC_COUNTER_BUFFER, 0, blankData);
    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, null);

    gl.bindBufferBase(gl.ATOMIC_COUNTER_BUFFER, 0, gl.atomicGMCounter[buffs[1]]);

    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboGlobalMap[buffs[0]]);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboGlobalMap[buffs[1]]);


    let xVal = Math.ceil(divup(gl.mapSize[0], 400));
    gl.dispatchCompute(xVal, 1, 1);

    gl.memoryBarrier(gl.ALL_BARRIER_BITS);

    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, gl.atomicGMCounter[buffs[1]]);
    gl.getBufferSubData(gl.ATOMIC_COUNTER_BUFFER, 0, gl.mapSize);
    gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, null);

    gl.buffSwitch = buffs[1];
  }

  function genVirtualFrame(gl, invT) {

    gl.useProgram(genVirtualFrameProg);

    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.virtualFrameFBO);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, imageSize[0], imageSize[1]);

    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboGlobalMap[gl.buffSwitch]);

    gl.uniformMatrix4fv(gl.getUniformLocation(genVirtualFrameProg, "invT"), false, invT);
    gl.uniform4fv(gl.getUniformLocation(genVirtualFrameProg, "cam"), camPam);
    gl.uniform2fv(gl.getUniformLocation(genVirtualFrameProg, "imSize"), imageSize);
    gl.uniform1f(gl.getUniformLocation(genVirtualFrameProg, "maxDepth"), maxDepth);
    gl.uniform1f(gl.getUniformLocation(genVirtualFrameProg, "c_stable"), gl.cStable);

    gl.drawArrays(gl.POINTS, 0, gl.mapSize[0]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function calcPoseSplat(gl) {

    generateVertNorms(gl, imageSize[0], imageSize[1]);

    var T = glMatrix.mat4.create();

    if (resetFlag == 0) {

      // //T = [...pose];
      // var level = 0;

      // var A = new Float32Array(36); // 6 * 6
      // var b = new Float32Array(6);
      // var result = new Float32Array(6);
      // var icpData = {AE:0.0, icpCount:0};

      // // use proper lvls ....
      // for (let i = 0; i < 2; i++)
      // {
      //   var delta = glMatrix.mat4.create();
      //   trackP2P(gl, imageSize[0], imageSize[1], T, level);
      //   reduceP2P(gl);
      //   getReduction(gl, A, b, icpData);
      //   solve(A, b, result);
      //   resultToMatrix(result, delta);

      //   glMatrix.mat4.mul(T, delta, T);
      // }
      // //pose = [...T];
    }
    else {
      // reseting 
      let blankData = new Uint32Array(1);
      let blankArr = new Float32Array(4 * 4 * 5e6); // 4 x vec4 x 5Million values


      for (let i = 0; i < 2; i++) {
        gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, gl.atomicGMCounter[i]);
        gl.bufferSubData(gl.ATOMIC_COUNTER_BUFFER, 0, blankData);
        gl.bindBuffer(gl.ATOMIC_COUNTER_BUFFER, null);
      }

      for (let i = 0; i < 2; i++) {
        gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboGlobalMap[i]);
        gl.bufferSubData(gl.SHADER_STORAGE_BUFFER, 0, blankArr);
        gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, null);
      }




      getClickedPoint(gl);
    }

    // glMatrix.mat4.multiply(pose, pose, T);

    let invPose = glMatrix.mat4.create();
    glMatrix.mat4.invert(invPose, pose);

    genIndexMap(gl, invPose);

    if (resetFlag == 1)
    {
      resetFlag = 0;
      integrateFlag = 1;
    }


    if (integrateFlag) {
      updateGlobalMap(gl, pose); // frameCounter is counting window draws, not realsense frame number
      removeUnnecessaryPoints(gl);
    }


    genVirtualFrame(gl, invPose);

    

  }

  function solveSO3(_A, _b, _result) {
    let A = Array.from(_A);
    let b = Array.from(_b);
    let folded_A = luqr.fold(A, 3);
    let res = Array(3);
    res = luqr.solve(folded_A,b);
    if (res != null)
    {
      for (let i = 0; i < res.length; i++)
      {
        _result[i] = res[i];
      }
    }
  }

  function getReductionSO3(gl, _A, _b, _so3Data) {

    const outputData = new Float32Array(8 * 11);
    gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboOutputSO3);
    gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, outputData);
    for (let row = 1; row < 8; row++) {
        for (let col = 0; col < 11; col++) {
          outputData[col + 0 * 11] += outputData[col + row * 11];
        }
    }


  /*
  vector b
  | 3 |
  | 6 |
  | 8 |
  and
  matrix a
  | 0  | 1 | 2 |
  | 1  | 4 | 5 |
  | 2  | 5 | 7 |
  */

    var shift = 0;
    for (let i = 0; i < 3; ++i) {
        for (let j = i; j < 4; ++j) {
            let value = outputData[shift++];
            if (j == 3) {
              _b[i] = value;
            }
            else {
              _A[j * 3 + i] = _A[i * 3 + j] = value;
            }
        }
    }
    _so3Data.SO3Error = Math.sqrt(outputData[9] / outputData[10]);
    _so3Data.SO3Count = outputData[10];
}

  function reduceSO3(gl, level) {
    gl.useProgram(so3ReduceProg);

    gl.uniform2iv(gl.getUniformLocation(so3ReduceProg, "imSize"), imageSize);

    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReductionSO3);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboOutputSO3);

    gl.dispatchCompute(8, 1, 1);
    gl.memoryBarrier(gl.ALL_BARRIER_BITS);

  }

  function trackSO3(gl, level, homography, K_mat_inv, K_R_lr) {
    gl.useProgram(so3TrackProg);

    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReductionSO3);

    gl.bindImageTexture(0, gl.colorLast_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);
    gl.bindImageTexture(1, gl.color_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);

    gl.uniformMatrix3fv(gl.getUniformLocation(so3TrackProg, "imageBasis"), false, homography);
    gl.uniformMatrix3fv(gl.getUniformLocation(so3TrackProg, "kinv"), false, K_mat_inv);
    gl.uniformMatrix3fv(gl.getUniformLocation(so3TrackProg, "krlr"), false, K_R_lr);

    gl.dispatchCompute(divup(imageSize[0] >> level, 32), divup(imageSize[1] >> level, 32), 1);
    gl.memoryBarrier(gl.ALL_BARRIER_BITS);
  }

  function calcPoseSO3(gl) {

    let pyramidLevel = 0;
    let resultR = glMatrix.mat3.create();
    let delta = glMatrix.mat3.create();
    let K_mat = glMatrix.mat3.create();
    let K_mat_inv = glMatrix.mat3.create();

    K_mat[0] = colorCamPam[2] / (Math.pow(2, pyramidLevel));
    K_mat[4] = colorCamPam[3] / (Math.pow(2, pyramidLevel));
    K_mat[6] = colorCamPam[0] / (Math.pow(2, pyramidLevel));
    K_mat[7] = colorCamPam[1] / (Math.pow(2, pyramidLevel));

    glMatrix.mat3.invert(K_mat_inv, K_mat);

    let lastError = 10000000000000;
    let lastCount = 10000000000000;

    let lastResultR = glMatrix.mat3.create();

    for (let i = 0; i < 10; i++) {
      let homography = glMatrix.mat3.create();
      let temp0 = glMatrix.mat3.create();

      glMatrix.mat3.multiply(temp0, resultR, K_mat_inv);
      glMatrix.mat3.multiply(homography, K_mat, temp0);

      // let imageBasis = glMatrix.mat3.create();
      // glMatrix.mat3.transpose(imageBasis, homography); // do we need to do this, or is thi sjust to get eigen/glm formats correct?

      let K_R_lr = glMatrix.mat3.create();
      glMatrix.mat3.multiply(K_R_lr, K_mat, resultR);

      var A = new Float32Array(9); // 3 * 3
      var b = new Float32Array(3);
      var result = new Float32Array(3);
      var so3Data = {SO3Error:0.0, SO3Count:0};


      trackSO3(gl, pyramidLevel, homography, K_mat_inv, K_R_lr);
      reduceSO3(gl, pyramidLevel);
      getReductionSO3(gl, A, b, so3Data);

      if (so3Data.SO3Error < lastError && lastCount == so3Data.SO3Count) {
        break;
      }
      else if (so3Data.SO3Error > lastError + 0.001) {
        so3Data.SO3Error = lastError;
        so3Data.SO3Count = lastCount;
        resultR = lastResultR;
        break;
      }

      lastError = so3Data.SO3Error;
      lastCount = so3Data.SO3Count;
      lastResultR = resultR;

      solveSO3(A, b, result);

      resultToMatrixSO3(result, delta);

      glMatrix.mat3.mul(resultR, delta, resultR);
    }

    let tempMat4 = glMatrix.mat4.create();

    glMatrix.mat4.set(tempMat4, resultR[0], resultR[1], resultR[2], 0, 
                                resultR[3], resultR[4], resultR[5], 0,
                                resultR[6], resultR[7], resultR[8], 0,
                                0, 0, 0, 1)
                                ;
    glMatrix.mat4.mul(pose, pose, tempMat4);

    // let invPoseSO3 = glMatrix.mat4.create();
    // glMatrix.mat4.invert(invPoseSO3, poseSO3);
    // genVirtualFrame(gl, invPoseSO3);

    //console.log(poseSO3);
  }



  function residualSE3(gl, level, Kt, KRK_inv, se3Data) {
    gl.useProgram(se3TrackProg);

    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReductionSE3);

    gl.bindImageTexture(0, gl.colorLast_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);
    gl.bindImageTexture(1, gl.color_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);
    gl.bindImageTexture(2, gl.gradient_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(3, gl.mappingC2D_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA16UI)
    gl.bindImageTexture(4, gl.mappingD2C_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA16UI)
    gl.bindImageTexture(5, gl.depthLast_texture, 0, false, 0, gl.READ_ONLY, gl.R32F)
    gl.bindImageTexture(6, gl.depth_texture, 0, false, 0, gl.READ_ONLY, gl.R32F)

    gl.uniform1f(gl.getUniformLocation(se3TrackProg, "minScale"), 0.005);
    gl.uniform1f(gl.getUniformLocation(se3TrackProg, "maxDepthDelta"), 0.05);
    gl.uniform1f(gl.getUniformLocation(se3TrackProg, "level"), level);

    gl.uniform3fv(gl.getUniformLocation(se3TrackProg, "kt"), Kt);
    gl.uniformMatrix3fv(gl.getUniformLocation(se3TrackProg, "krkinv"), false, KRK_inv);

    gl.dispatchCompute(divup(imageSize[0] >> level, 32), divup(imageSize[1] >> level, 32), 1);
    gl.memoryBarrier(gl.ALL_BARRIER_BITS);
  }

  function residualReduceSE3(gl) {
    gl.useProgram(se3ReduceProg);

    gl.uniform2iv(gl.getUniformLocation(se3ReduceProg, "imSize"), imageSize);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReductionSE3);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboReductionOutputSE3);

    gl.dispatchCompute(8, 1, 1);
    gl.memoryBarrier(gl.ALL_BARRIER_BITS);
  }

  function getResidualReductionSE3(gl, se3Data) {
    const outputData = new Float32Array(8 * 2);
    gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboReductionOutputSE3);
    gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, outputData);

    let count = 0;
    let sigma = 0;
    for (let i = 0; i < 16; i += 2) {
      count += outputData[i];
      sigma += outputData[i + 1];
    }

    se3Data.SE3sigma = Math.sqrt(sigma / count == 0 ? 1 : count);
    se3Data.SE3Error = Math.sqrt(sigma) / (count == 0 ? 1 : count);
  }



  function stepSE3(gl, level, Kcampam, se3Data) {
    gl.useProgram(se3TrackStepProg)

    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboReductionSE3);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboJtJJtrSE3);

    gl.bindImageTexture(0, gl.vertexLast_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(1, gl.gradient_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    gl.bindImageTexture(2, gl.mappingC2D_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA16UI)
    gl.bindImageTexture(3, gl.mappingD2C_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA16UI)

    gl.uniform1f(gl.getUniformLocation(se3TrackStepProg, "sigma"), se3Data.SE3sigma);
    gl.uniform1f(gl.getUniformLocation(se3TrackStepProg, "sobelScale"), 0.005);
    gl.uniform4fv(gl.getUniformLocation(se3TrackStepProg, "cam"), Kcampam);
    gl.uniform1i(gl.getUniformLocation(se3TrackStepProg, "level"), level);


    gl.dispatchCompute(divup(imageSize[0] >> level, 32), divup(imageSize[1] >> level, 32), 1);
    gl.memoryBarrier(gl.ALL_BARRIER_BITS);

  }

  function stepReduceSE3(gl) {
    gl.useProgram(se3ReduceStepProg);

    gl.uniform2iv(gl.getUniformLocation(se3ReduceStepProg, "imSize"), imageSize);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboJtJJtrSE3);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboJtJJtrOutputSE3);

    gl.dispatchCompute(8, 1, 1);

  }

  function getStepReductionSE3(gl, _A, _b) {
    const outputData = new Float32Array(8 * 32);
    gl.bindBuffer(gl.SHADER_STORAGE_BUFFER, gl.ssboJtJJtrOutputSE3);
    gl.getBufferSubData(gl.SHADER_STORAGE_BUFFER, 0, outputData);
    for (let row = 1; row < 8; row++) {
        for (let col = 0; col < 32; col++) {
          outputData[col + 0 * 32] += outputData[col + row * 32];
        }
    }

    /*
		vector b
		| 6  |
		| 12 |
		| 17 |
		| 21 |
		| 24 |
		| 26 |
		
		and
		matrix a
		| 0  | 1  | 2  | 3  | 4  | 5  |
		| 1  | 7  | 8  | 9  | 10 | 11 |
		| 2  | 8  | 13 | 14 | 15 | 16 |
		| 3  | 9  | 14 | 18 | 19 | 20 |
		| 4  | 10 | 15 | 19 | 22 | 23 |
		| 5  | 11 | 16 | 20 | 23 | 25 |
    */

   var shift = 0;
   for (let i = 0; i < 6; ++i) {
       for (let j = i; j < 7; ++j) {
           let value = outputData[shift++];
           if (j == 6) {
             _b[i] = value;
           }
           else {
             _A[j * 6 + i] = _A[i * 6 + j] = value;
           }
       }
   }
  }




  function calcPoseSE3(gl) {

    calcGradient(gl, 0, imageSize[0], imageSize[1]);

    let lastRGBError = 3.402823e+38;

    let tprev = glMatrix.vec3.fromValues(pose[12], pose[13], pose[14]);
    
    let tcurr = glMatrix.vec3.clone(tprev);

    let resultRt_prev = glMatrix.mat4.create();
    let resultRt = glMatrix.mat4.create();


    for (let lvl = 0; lvl >= 0; lvl--) {

      let K_mat = glMatrix.mat3.create();
      let K_mat_inv = glMatrix.mat3.create();
  
      K_mat[0] = colorCamPam[2] / (Math.pow(2, lvl));
      K_mat[4] = colorCamPam[3] / (Math.pow(2, lvl));
      K_mat[6] = colorCamPam[0] / (Math.pow(2, lvl));
      K_mat[7] = colorCamPam[1] / (Math.pow(2, lvl));

      let Kcampam = [K_mat[0], K_mat[4], K_mat[6], K_mat[7]];
  
      glMatrix.mat3.invert(K_mat_inv, K_mat);


      for (let iter = 0; iter < 5; iter++) {
        let resultRt_inv = glMatrix.mat4.create();
        glMatrix.mat4.invert(resultRt_inv, resultRt);

        let R = glMatrix.mat3.create();
        glMatrix.mat3.fromMat4(R, resultRt_inv);

        let KRK_inv = glMatrix.mat3.create();
        let temp0 = glMatrix.mat3.create();

        glMatrix.mat3.mul(temp0, R, K_mat_inv);
        glMatrix.mat3.mul(KRK_inv, K_mat, temp0);

        let Kt = glMatrix.vec3.fromValues(resultRt_inv[12], resultRt_inv[13], resultRt_inv[14]);

        glMatrix.vec3.transformMat3(Kt, Kt, K_mat)

        var A = new Float32Array(36); // 3 * 3
        var b = new Float32Array(6);
        var result = new Float32Array(6);
        var se3Data = {SE3Error:0.0, SE3sigma:0};
        let delta = glMatrix.mat4.create();

        residualSE3(gl, lvl, Kt, KRK_inv, se3Data);
        residualReduceSE3(gl, lvl, Kt, KRK_inv, se3Data);
        getResidualReductionSE3(gl, se3Data);

        stepSE3(gl, lvl, Kcampam, se3Data);
        stepReduceSE3(gl);
        getStepReductionSE3(gl, A, b);
        solve(A, b, result);
        computeUpdateSE3(result, delta);

        glMatrix.mat4.mul(resultRt, delta, resultRt);

        tprev = glMatrix.vec3.fromValues(resultRt[12], resultRt[13], resultRt[14]);

      }


    }

    let diff = glMatrix.vec3.create();
    glMatrix.vec3.sub(diff, tprev, tcurr);
    //if (glMatrix.vec3.length(diff) < 0.3) {
      glMatrix.mat4.mul(pose, pose, resultRt);
    //}

    // let invPoseSE3 = glMatrix.mat4.create();
    // glMatrix.mat4.invert(invPoseSE3, poseSE3);
    // genVirtualFrame(gl, invPoseSE3);
  }