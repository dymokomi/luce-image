// One dab of the brush over a tile: an ellipse (radius, roundness, turned by
// direction) with a hard core and a linear falloff, emitting premultiplied
// paint scaled by flow. Composited `over` into the paint tile, dabs build up
// like real paint; the tip texture is applied to the whole stroke by paint.frag.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec2 origin;      // the tile's top-left in target pixels (0, 0 for a tile target)
    vec2 center;      // the dab's centre, tile pixels
    vec2 tile;        // the tile's top-left in document pixels, for textures
    vec2 direction;   // (cos, sin) of the tip's angle
    float radius;
    float hardness;   // 0..1: the fraction of the radius at full coverage
    float flow;       // 0..1
    float roundness;  // minor over major axis, 0.05..1
    float red;
    float green;
    float blue;
    float unused0;
    float unused1;
    float unused2;
    float unused3;
    float unused4;
} params;
void main() {
    vec2 p = gl_FragCoord.xy - params.origin - params.center;
    vec2 q = vec2(dot(p, params.direction), dot(p, vec2(-params.direction.y, params.direction.x)));
    q.y /= max(params.roundness, 0.05);
    float d = length(q);
    float core = params.radius * params.hardness;
    float c = 1.0 - smoothstep(core, max(params.radius, core + 0.5), d);
    float a = c * params.flow * vertex_color.a;
    fragment_color = vec4(vec3(params.red, params.green, params.blue) * a, a);
}
