  function uploadGraphPoints(gl, _x, _y, _z) {

    gl.useProgram(plottingBufferProg);

    let scaledX = normalize(_x, initPose[12]+0.1, initPose[12]-0.1);
    let scaledY = normalize(_y, initPose[13]+0.1, initPose[13]-0.1);
    let scaledZ = normalize(_z, initPose[14]+0.1, initPose[14]-0.1);

    gl.uniform4fv(gl.getUniformLocation(plottingBufferProg, "newData"), [scaledX, scaledY, scaledZ, 0.0]);
    gl.uniform1i(gl.getUniformLocation(plottingBufferProg, "pingPong"), gl.frameCounter % 2);

    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 0, gl.ssboGraphX);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 1, gl.ssboGraphY);
    gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 2, gl.ssboGraphZ);

    gl.dispatchCompute(1, 1, 1);
    gl.memoryBarrier(gl.SHADER_IMAGE_ACCESS_BARRIER_BIT);

  }

function render(gl, width, height) {


  // gl.useProgram(tfTestProg);
  // gl.viewport(0,0,width,240)

  // var queryTest = gl.createQuery();
  // gl.beginQuery(gl.TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN, queryTest)
  // gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, gl.transformFeedback);
  // gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, gl.bufferTF);
  // gl.beginTransformFeedback(gl.POINTS);
  // gl.drawArrays(gl.POINTS, 0, 32);

  // gl.endTransformFeedback();

  // gl.endQuery(gl.TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN);

  // var counter = gl.getQueryParameter(queryTest, gl.QUERY_RESULT);

  // console.log(counter);

  // let bufferOut = new Float32Array(32);
  //     gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, gl.bufferTF);
  //   gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bufferOut);
  //   gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);

    gl.viewport(0, 0, width, 240);

    gl.useProgram(plottingRenderProgram);
    gl.bindVertexArray(gl.vaoPlotting);

    gl.uniform2fv(gl.getUniformLocation(plottingRenderProgram, "imageSize"), [1024.0, 240.0]);

    gl.uniform1i(gl.getUniformLocation(plottingRenderProgram, "axis"), 0);
    gl.drawArrays(gl.POINTS, 0, 1024);     

    gl.uniform1i(gl.getUniformLocation(plottingRenderProgram, "axis"), 1);
    gl.drawArrays(gl.POINTS, 0, 1024);

    gl.uniform1i(gl.getUniformLocation(plottingRenderProgram, "axis"), 2);
    gl.drawArrays(gl.POINTS, 0, 1024);
    gl.bindVertexArray(null);

    gl.viewport(0, 240, width / 2.0, height - 240);

	gl.useProgram(renderProgram);
    gl.bindVertexArray(gl.vaoRender);

    let renderOpts = renderDepthFlag << 0 | 
        renderColorFlag << 1 |
        renderRefNormFlag << 2 |
        renderRefVertFlag << 3 |
        renderNormFlag << 4 |
        renderVertFlag << 5;

    gl.uniform1i(gl.getUniformLocation(renderProgram, "renderOptions"), renderOpts);
    gl.uniform2fv(gl.getUniformLocation(renderProgram, "imageSize"), imageSize);

    gl.uniform1i(gl.getUniformLocation(renderProgram, "depth"), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.depth_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "colorMap"), 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gl.colorAligned_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "refNormalMap"), 2);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, gl.refNormal_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "refVertexMap"), 3);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, gl.refVertex_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "normalMap"), 4);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, gl.normal_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "vertexMap"), 5);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, gl.vertex_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "indexMap"), 6);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, gl.indexMap_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "gradientMap"), 7);
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, gl.gradient_texture);
    // gl.bindImageTexture(0, gl.color_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);
    // gl.bindImageTexture(1, gl.refNormal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    // gl.bindImageTexture(2, gl.refVertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    // gl.bindImageTexture(3, gl.normal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    // gl.bindImageTexture(4, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F);
    // gl.bindImageTexture(5, gl.indexMap_texture, 0, false, 0, gl.READ_ONLY, gl.R32F);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.vertex_buffer);
    gl.vertexAttribPointer(gl.vertex_location, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.index_buffer);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.viewport(width / 2.0, 240, width / 2.0, height - 240);

    renderOpts = 1 << 0 | 
                       0 << 1 |
                       0 << 2 |
                       0 << 3 |
                       0 << 4 |
                       0 << 5 |
                       0 << 6;

    gl.uniform1i(gl.getUniformLocation(renderProgram, "renderOptions"), renderOpts);
    gl.uniform2fv(gl.getUniformLocation(renderProgram, "imageSize"), imageSize);

    gl.uniform1i(gl.getUniformLocation(renderProgram, "depth"), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.depth_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "colorMap"), 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, gl.virtualColorFrame_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "refNormalMap"), 2);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, gl.refNormal_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "refVertexMap"), 3);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, gl.refVertex_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "normalMap"), 4);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, gl.normal_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "vertexMap"), 5);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, gl.vertex_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "indexMap"), 6);
    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, gl.indexMap_texture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "gradientMap"), 7);
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, gl.gradient_texture);

    // gl.bindImageTexture(0, gl.color_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA8UI);
    // gl.bindImageTexture(1, gl.refNormal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F)
    // gl.bindImageTexture(2, gl.refVertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F)
    // gl.bindImageTexture(3, gl.normal_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F)
    // gl.bindImageTexture(4, gl.vertex_texture, 0, false, 0, gl.READ_ONLY, gl.RGBA32F)
    // gl.bindImageTexture(5, gl.indexMap_texture, 0, false, 0, gl.READ_ONLY, gl.R32F);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.vertex_buffer);
    gl.vertexAttribPointer(gl.vertex_location, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.index_buffer);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);

}

function yawPitchRoll(yaw, pitch, roll) {

  var cosYaw = Math.cos(yaw);
  var sinYaw = Math.sin(yaw);
  var cosPitch = Math.cos(pitch);
  var sinPitch = Math.sin(pitch);
  var cosRoll = Math.cos(roll);
  var sinRoll = Math.sin(roll);

return [
cosYaw * cosPitch,
cosYaw * sinPitch * sinRoll - sinYaw * cosRoll,
cosYaw * sinPitch * cosRoll + sinYaw * sinRoll,
0.0,
sinYaw * cosPitch,
sinYaw * sinPitch * sinRoll + cosYaw * cosRoll,
sinYaw * sinPitch * cosRoll - cosYaw * sinRoll,
0.0,
-sinPitch,
cosPitch * sinRoll,
cosPitch * cosRoll,
0.0,
0.0, 0.0, 0.0, 1.0
];
}

function renderMarchingCubes(gl) {




var translateModel = glMatrix.vec3.create();
var translateView = glMatrix.vec3.create();

//vec3.set(translateModel, (gl.size / gl.ogSize[0]) / 3.0, (gl.size / gl.ogSize[1]) / 3.0, (gl.size / gl.ogSize[2]) / 3.0); //make offset to centre of og volume in units of -1 -> 1
glMatrix.vec3.set(translateModel, 0, 0, (512.0 - volSize[2]) / 256.0); //make offset to centre of og volume in units of -1 -> 1

glMatrix.vec3.set(translateView, cameraPos[0], cameraPos[1], -zoom);
var model = glMatrix.mat4.create();
var view = glMatrix.mat4.create();

glMatrix.mat4.translate(model, model, translateModel);

glMatrix.mat4.translate(view, view, translateView);

glMatrix.mat4.rotateX(view, view, rotation[1]);
glMatrix.mat4.rotateY(view, view, rotation[0]);

var perspective = glMatrix.mat4.create();

glMatrix.mat4.perspective(perspective, 45 * Math.PI / 180, viewport.z / viewport.w, .01, 1000);

var MV = glMatrix.mat4.create();
var MVP = glMatrix.mat4.create();

glMatrix.mat4.multiply(MV, view, model);

glMatrix.mat4.multiply(MVP, perspective, MV);

gl.viewport(viewport.x, viewport.y, viewport.z, viewport.w);

gl.useProgram(mcRenderProg);

gl.bindVertexArray(gl.vaoMarchingCubes);

//Clear color buffer
// gl.clearColor(0.0, 0.0, 0.0, 1.0);
// gl.clear(gl.COLOR_BUFFER_BIT);
// gl.clearDepth(1.0);                 // Clear everything
// gl.enable(gl.DEPTH_TEST);           // Enable depth testing
gl.depthFunc(gl.LEQUAL); // Near things obscure far things
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

gl.uniformMatrix4fv(gl.getUniformLocation(mcRenderProg, 'MVP'), false, MVP);
gl.uniform1f(gl.getUniformLocation(mcRenderProg, "pixDims"), 0.001 * volSize[0] / volLength);

gl.uniform1i(gl.getUniformLocation(mcRenderProg, 'volumeData'), 0);
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_3D, gl.hp_texture);

gl.drawArrays(gl.TRIANGLES, 0, (gl.totalSumVerts));

//gl.drawArrays(gl.POINTS, 0, (gl.totalSumVerts));




gl.bindVertexArray(null);

}