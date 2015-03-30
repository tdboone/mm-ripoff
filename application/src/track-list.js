'use strict';

var urlRoot = 'assets/tilemaps/maps/';

module.exports = {
    'Desert' : {
        'Two-Segment Track'  : [
            // Each array at this depth represents a row. This track has only one row of two segments.
            [
                // The first segment in this row will be one of these
                [
                    urlRoot + 'desert/two-segment/left-1.json',
                    urlRoot + 'desert/two-segment/left-2.json'
                ],
                // The second segment in this row will be one of these
                [
                    urlRoot + 'desert/two-segment/right-1.json',
                    urlRoot + 'desert/two-segment/right-2.json'
                ]
            ]
        ],
        'Gravel and Pits'    : urlRoot + 'desert/gravel-and-pits.json',
        'Square Loop'        : urlRoot + 'desert/square-loop.json',
        'Figure 8'           : urlRoot + 'desert/figure8.json',
        'Bathroom Obstacles' : urlRoot + 'desert/figure8wObs.json'
    },
    'Bathroom' : {
        'Countertop Sampler' : urlRoot + '/bathroom/countertop-sampler.json'
    },
    'Misc' : {
        'Hardwood' : urlRoot + 'misc/hardwood.json'
    }
};
