const so3TrackSource = `#version 310 es
layout (local_size_x = 32, local_size_y = 32, local_size_z = 1) in;
layout(binding = 0, rgba8) uniform readonly highp image2D lastColorMap;
layout(binding = 1, rgba8) uniform readonly highp image2D nextColorMap;

uniform mat3 imageBasis;
uniform mat3 kinv;
uniform mat3 krlr;

layout(std430, binding = 0) buffer rowSO3data
{
    vec4 rowSO3[];
};

float luminance(vec3 rgb)
{
    return 0.299f * float(rgb.x) + 0.587f * float(rgb.y) + 0.114f * float(rgb.z);
}

vec2 getGradient(int imageNumber, ivec2 pixel)
{
  vec2 gradient;
  
  if (imageNumber == 0)
  {
    float lumi = luminance(imageLoad(lastColorMap, pixel).xyz);
    float back = luminance(imageLoad(lastColorMap, ivec2(pixel.x - 1, pixel.y)).xyz);
    float fore = luminance(imageLoad(lastColorMap, ivec2(pixel.x + 1, pixel.y)).xyz);
    gradient.x = ((back + lumi) / 2.0f) - ((fore + lumi) / 2.0f);
    back = luminance(imageLoad(lastColorMap, ivec2(pixel.x, pixel.y - 1)).xyz);
    fore = luminance(imageLoad(lastColorMap, ivec2(pixel.x, pixel.y + 1)).xyz);
    gradient.y = ((back + lumi) / 2.0f) - ((fore + lumi) / 2.0f);
  }
  else if (imageNumber == 1)
  {
    float lumi = luminance(imageLoad(nextColorMap, pixel).xyz);
    float back = luminance(imageLoad(nextColorMap, ivec2(pixel.x - 1, pixel.y)).xyz);
    float fore = luminance(imageLoad(nextColorMap, ivec2(pixel.x + 1, pixel.y)).xyz);
    gradient.x = ((back + lumi) / 2.0f) - ((fore + lumi) / 2.0f);
    back = luminance(imageLoad(nextColorMap, ivec2(pixel.x, pixel.y - 1)).xyz);
    fore = luminance(imageLoad(nextColorMap, ivec2(pixel.x, pixel.y + 1)).xyz);
    gradient.y = ((back + lumi) / 2.0f) - ((fore + lumi) / 2.0f);
  }

	return gradient;
}


void main()
{
	ivec2 pix = ivec2(gl_GlobalInvocationID.xy);
	ivec2 imSize = imageSize(lastColorMap);


	bool found_coresp = false;

	vec3 unwarpedReferencePoint = vec3(pix.xy, 1.0f);

	vec3 warpedReferencePoint = (imageBasis) * unwarpedReferencePoint;

	ivec2 wrPixel = ivec2((warpedReferencePoint.x / warpedReferencePoint.z) + 0.5f,
					      (warpedReferencePoint.y / warpedReferencePoint.z) + 0.5f);

	if(wrPixel.x >= 1 &&
       wrPixel.x < imSize.x - 1 &&
       wrPixel.y >= 1 &&
       wrPixel.y < imSize.y - 1 &&
       pix.x >= 1 &&
       pix.x < imSize.x - 1 &&
       pix.y >= 1 &&
       pix.y < imSize.y - 1)
	{
		found_coresp = true;
    }

	vec4 row = vec4(0.0f);

	if (found_coresp)
	{
		vec2 gradNext = getGradient(1, wrPixel);
		vec2 gradLast = getGradient(0, wrPixel);

	  float gx = (gradNext.x + gradLast.x) / 2.0f;
    float gy = (gradNext.y + gradLast.y) / 2.0f;

		vec3 point = (kinv) * unwarpedReferencePoint;

    float z2 = point.z * point.z;

    float a = krlr[0].x;
    float b = krlr[1].x;
    float c = krlr[2].x;

    float d = krlr[0].y;
    float e = krlr[1].y;
    float f = krlr[2].y;

    float g = krlr[0].z;
    float h = krlr[1].z;
    float i = krlr[2].z;

    vec3 leftProduct = vec3(((point.z * (d * gy + a * gx)) - (gy * g * float(pix.y)) - (gx * g * float(pix.x))) / z2,
                        ((point.z * (e * gy + b * gx)) - (gy * h * float(pix.y)) - (gx * h * float(pix.x))) / z2,
                        ((point.z * (f * gy + c * gx)) - (gy * i * float(pix.y)) - (gx * i * float(pix.x))) / z2);

		vec3 jacRow = cross(leftProduct, point);

		row = vec4(jacRow.xyz, -(luminance(imageLoad(nextColorMap, wrPixel).xyz) - luminance(imageLoad(lastColorMap, pix).xyz)) );


	}

	rowSO3[pix.y * imSize.x + pix.x] = row;

}
  `;