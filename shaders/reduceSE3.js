const se3ReduceSource = `#version 310 es
layout(local_size_x = 112, local_size_y = 1) in;

uniform ivec2 imSize;

struct DataTerm
{
	ivec2 zero;
    ivec2 one;
    float diff;
    bool valid;
};

layout(std430, binding = 0) buffer corresData
{
    DataTerm corresImg[];
};

layout(std430, binding = 1) buffer reductionOutputData
{
	float outputData[];
};

shared float S[112][2];


void main()
{
	int devNumber = 0;
    int sline = int(gl_LocalInvocationID.x); // 0 - 111

    float sums[2];

    for (int i = 0; i < 2; ++i)
    {
        sums[i] = 0.0f;
    }

    for (int y = int(gl_WorkGroupID.x); y < imSize.y; y += int(gl_NumWorkGroups.x)) 
    {
        for (int x = sline; x < imSize.x; x += int(gl_WorkGroupSize.x))
        {
            if (corresImg[(y * imSize.x) + x].valid == false)
            {
                continue;
            }

			sums[0] += 1.0f;
            sums[1] += corresImg[(y * imSize.x) + x].diff * corresImg[(y * imSize.x) + x].diff;
        }
    }


    for (int i = 0; i < 2; ++i)
    {
        S[sline][i] = sums[i];
    }    

    barrier(); // wait for threads to finish

    if (sline < 2)
    {
        for (int i = 1; i < int(gl_WorkGroupSize.x); ++i)
        {
            S[0][sline] += S[i][sline];
        }

        outputData[sline + int(gl_WorkGroupID.x) * 2] = S[0][sline];
    }
}
`;