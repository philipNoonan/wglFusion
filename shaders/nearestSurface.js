const handMaskGlobalMapSource = `#version 310 es
layout(local_size_x = 32, local_size_y = 32) in;

layout(binding = 0, r32f) readonly uniform highp image2D maskMap;	
layout(binding = 1, rgba32f) readonly uniform highp image2D mVertMap;	// Vertex map (measured)

layout(binding = 3, rgba16ui) readonly uniform highp uimage2D mappingC2DMap;
layout(binding = 4, rgba16ui) readonly uniform highp uimage2D mappingD2CMap;

layout(binding = 0, offset = 0) uniform atomic_uint g_idx;

uniform mat4 T;		// Transformation from the sensor to the world
uniform mat4 invT;	// Transformation from the world to the sensor
uniform mat4 K;
uniform int timestamp;
uniform float sigma;
uniform uint maxMapSize;
uniform float c_stable;	// points with "c >= c_stable" are considered stable
uniform int firstFrame;

const float radThresh = 0.2588190451f;	// cos(PI * 75.0 / 180.0)
const float PI = 3.1415927f;
const float PI_2 = PI / 2.0f;
const float sqrt2 = 1.41421356237f;


// Data structure
struct gMapData
{
	vec4 data;	// Confidence, radius, timestamp, timeFirstSeen 
	vec4 vert;	// Vertex
	vec4 norm;	// Normal
	vec4 color;	// Color
};

// Distance global map
layout(std430, binding = 0) buffer gMap
{
	gMapData data[];
} elems;


bool closeEachOther(int idxSelect, int idxCandi)
{
	float distV = length(elems.data[idxSelect].vert.xyz - elems.data[idxCandi].vert.xyz);
	float distN = dot(elems.data[idxSelect].norm.xyz, elems.data[idxCandi].norm.xyz);
	float distR = abs(elems.data[idxSelect].data.y - elems.data[idxCandi].data.y);
	float distC = abs(calcLuminance(elems.data[idxSelect].color.xyz) - calcLuminance(elems.data[idxCandi].color.xyz));

	// NOTE: I'm not sure if these parameters are proper or not...
	if (distV <= 0.05f && distN > 0.5f && distR < 1.4f && distC > 0.85f) 
	{
		return true;
	}
	else
	{
		return false;
	}
}



void main(void)
{
	ivec2 uv = ivec2(gl_GlobalInvocationID.xy);
	// current vertex and normal
	vec3 inputVert = vec3(imageLoad(mVertMap, uv).xyz);
	vec3 inputNorm = vec3(imageLoad(mNormMap, uv).xyz);
	vec3 inputColor = vec3(imageLoad(mColorMap, uv).xyz);	// Note: Assuming "BGR" input
	//vec4 status = imageLoad(mTrackStatusmap, uv).xyzw;
	ivec2 bestPix;

	if (firstFrame == 1)
	{

		ivec2 res = imageSize(mVertMap);
		vec2 res_2 = vec2(res) / 2.0f;
		float gamma = length(vec2((float(uv.x) - K[2][0]) / res_2.x, (float(uv.y) - K[2][1]) / res_2.y));
		float alpha = exp(-pow(gamma, 2.0f) / (2.0f * pow(sigma, 2.0f)));
		float rad = getRadius(inputVert.z, inputNorm.z, 1.0f / K[0][0], 1.0f / K[1][1]);

		uint idx = atomicCounterIncrement(g_idx);
        
		elems.data[idx].vert = T * vec4(inputVert, 1.0f);
		elems.data[idx].norm = vec4(mat3(T) * inputNorm, 0.0f);
		elems.data[idx].color = vec4(inputColor, 1.0f);
		elems.data[idx].data.x = alpha * 10.0f;		// confidence
		elems.data[idx].data.y = rad;		// radius
		elems.data[idx].data.z = float(timestamp);	// timestamp
		elems.data[idx].data.w = float(timestamp);	// timestamp
	
	}
	else
	{
	if (inputVert.z > 0.0f && inputNorm.z < 0.0f) // should this have to be negative z for the norm?
	{
		// -----
		// ----- INTEGRATING NEW POINTS
		// -----
		// Point selection
		int idxSelect = -1;
		float tmpConf = -1.0f;
		//float sigma_depth = 0.05f;//calcSigmaDepth(inputVert.z, calcTheta(uv, K[0][0], vec2(K[2][0], K[2][1])));
		float sigma_depth = calcSigmaDepthRealsense(inputVert.z, uv, 0.05f);
		int idxCandi[16];
		
		vec3 _v[16];
		vec3 _n[16];

		float bestDist = 1000000.0f;

		for (int i = 0; i < 16; ++i)
		{
			// locally store the surrounding 16 pixels from the 4x index map
			idxCandi[i] = int(imageLoad(indexMap, ivec2(uv.x * 4 + i % 4, uv.y * 4 + i / 4)));
			if (idxCandi[i] >= 0)
			{
				_v[i] = mat4x3(invT) * elems.data[idxCandi[i]].vert;
				// 4.1 Data Association: Condition #1
				float dist = abs(inputVert.z - _v[i].z);
				if (dist < sigma_depth)
				{
					_n[i] = mat3(invT) * elems.data[idxCandi[i]].norm.xyz;
					float candiConf = elems.data[idxCandi[i]].data.x;
					// 4.1 Data Association: Condition #2 & #3
					// cos(PI * 20.0 / 180.0) = 0.93969262078
					if (dot(inputNorm, _n[i]) > 0.93969262078f && candiConf > tmpConf && dist < bestDist)
					{
						// find the id of the closest points that are facing the same way (to 20 degrees)
						idxSelect = idxCandi[i];
						tmpConf = candiConf;
						bestDist = dist;
						bestPix = ivec2(uv.x * 4 + i % 4, uv.y * 4 + i / 4);
					}
				}
			}
		}

		// clean foreground objects when a background object is the only thing in the line of sight

		// MEMO: Do we REALLY need "4.1 Data Association: Condition #4"??

		ivec2 res = imageSize(mVertMap);
		vec2 res_2 = vec2(res) / 2.0f;
		float gamma = length(vec2((float(uv.x) - K[2][0]) / res_2.x, (float(uv.y) - K[2][1]) / res_2.y));
		float alpha = exp(-pow(gamma, 2.0f) / (2.0f * pow(sigma, 2.0f)));
		//float rad = calcRadius(K[0][0], K[1][1], inputVert.z, inputNorm.z);
		float rad = getRadius(inputVert.z, inputNorm.z, 1.0f / K[0][0], 1.0f / K[1][1]);


		// if we have found a vertex that is close to the input vertex
		if (idxSelect >= 0)
		{


			// merge the point with the vertex already in the global map 
			bool bAveraged = false;
			// if the radius of the input vertex is less than 1.5x of the global vertex radius, then it should be merged
			if (rad <= (1.0f + 0.5f) * elems.data[idxSelect].data.y)
			{
				elems.data[idxSelect].vert = vec4(calcWeightedAvg(elems.data[idxSelect].vert.xyz, mat4x3(T) * vec4(inputVert, 1.0f), elems.data[idxSelect].data.x, alpha), 1.0f);
				elems.data[idxSelect].norm.xyz = normalize(calcWeightedAvg(elems.data[idxSelect].norm.xyz, mat3(T) * inputNorm, elems.data[idxSelect].data.x, alpha));
				elems.data[idxSelect].color = vec4(calcWeightedAvg(elems.data[idxSelect].color.rgb, inputColor, elems.data[idxSelect].data.x, alpha), 1.0f);
				bAveraged = true;
			}
			elems.data[idxSelect].data.x += alpha;									// confidence
			if (rad < elems.data[idxSelect].data.y) 
			{
				elems.data[idxSelect].data.y = rad;	// radius
			}
			elems.data[idxSelect].data.z = float(timestamp);								// timestamp

			// -----
			// ----- REMOVING POINTS
			// -----
			
			// 4.3 Removing points: Condition #1
			//     --> in "removePoints.comp"

			// if merging has occured, and the global vertex's onfidence is greater than the threshold
			if (elems.data[idxSelect].data.x >= c_stable)
			{



				
				// 4.3 Removing points: Condition #2
				// values here in depth space
				vec4 mergedDepthVec = invT * vec4(elems.data[idxSelect].vert.xyz, 1.0f);
				float mergedDepth = mergedDepthVec.z;

				float mergedNormZ = (mat3(invT) * elems.data[idxSelect].norm.xyz).z;


				for (int i = 0; i < 16; ++i)
				{
					if (idxCandi[i] >= 0 
						&& idxCandi[i] != idxSelect
						&& _v[i].z < mergedDepth
						&& abs(mergedNormZ) > 0.85f)
					{
						//imageStore(statusMap, ivec2((bestPix / 4.0f) + 0.5f), vec4(mergedDepth, _v[i].z, 0, 1));

						removePoint(idxCandi[i]);
					}
				}

				// 4.3 Removing points: Condition #3
				for (int i = 0; i < 16; ++i)
				{
					if (idxCandi[i] >= 0 && idxCandi[i] != idxSelect 
						&& closeEachOther(idxSelect, idxCandi[i]))
					{
						mergeAndRemove(idxSelect, idxCandi[i]);
					}
				}

				// Wheelan et al time condition, detect if time since last seen is > than some sensible threshold
				//for (int i = 0; i < 16; ++i)
				//{
				//	if (idxCandi[i] >= 0 && idxCandi[i] != idxSelect && 
				//		elems.data[idxCandi[i]].data.z - elems.data[idxCandi[i]].data.w > 20)
				//	{
				//		removePoint(idxCandi[i]);
				//	}
				//}

				

				
			}
		}
		// -----
		// ----- ADD NEW POINTS
		// -----
		else if (atomicCounter(g_idx) < maxMapSize) // New points
		{
			uint idx = atomicCounterIncrement(g_idx);
			elems.data[idx].vert = T * vec4(inputVert, 1.0f);
			elems.data[idx].norm = vec4(mat3(T) * inputNorm, 0.0f);
			elems.data[idx].color = vec4(inputColor, 1.0f);
			elems.data[idx].data.x = alpha;		// confidence
			elems.data[idx].data.y = rad;		// radius
			elems.data[idx].data.z = float(timestamp);	// timestamp
			elems.data[idx].data.w = float(timestamp);	// timestamp

		}
	}
	}

	
}
`;
