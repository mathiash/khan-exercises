jQuery.extend(KhanUtil, {

	expr: function(expr) {
		alert('deprecated call to expr');
        },

        exprCompute: function( expr, variables ) {
		if (typeof expr === "object") {
                        var computedParams = jQuery.map(expr.params, function(term, iTerms) {
				return KhanUtil.exprCompute(term, variables);
			});
			return KhanUtil.computeOperators[expr.op](computedParams);
		}
		else if (typeof expr === "string") {
			return variables[expr];
		}
		else {
			return expr;
		}
        },

	exprToString: function(expr) {
		if (typeof expr === "object")
			return KhanUtil.formatOperators[expr.op].apply( this, expr.params);
		else
			return expr.toString();
	},

	exprType: function( expr ) {
		if ( typeof expr === "object" ) {
			return expr.op;
		} else {
			return typeof(expr);
		}
	},

	// Do I start with a minus sign?
	exprIsNegated: function( expr ) {
		switch( KhanUtil.exprType(expr) ) {
			case "color":
			return KhanUtil.exprIsNegated(expr.params[1]);

			case "/":
			return KhanUtil.exprIsNegated(expr.params[0]);

			case "+":
			case "-":
			return true;

			case "number":
			return expr < 0;

			case "string":
			return expr.charAt(0) === "-";

			default:
			// case "*":
			return false;
		}
	},

	// Mostly, is it okay to add a coefficient to me without adding parens?
	exprIsShort: function( expr ) {
		switch( KhanUtil.exprType(expr) ) {
			case "color":
			return KhanUtil.exprIsShort(expr.params[1]);

			case "+":
			case "-":
			case "*":
			case "/":
			case "frac":
			return false;

			case "^":
			return KhanUtil.exprType(expr.params[0]) !== "number" || expr.params[0] < 0;

			case "number":
			case "sqrt":
			return true;

			default:
			return expr.length <= 1; // TO FIX ? (not sure what this is for)
		}
	},

	exprParenthesize: function( expr ) {
		return KhanUtil.exprIsShort(expr) ?
			KhanUtil.exprToString(expr) :
			"(" + KhanUtil.exprToString(expr) + ")";
	},

	formatOperators: {
		"color": function( color, arg ) {

			// Arguments should look like [ "blue", [ ... ] ]
			return "\\color{" + color + "}{" + KhanUtil.exprToString( arg ) + "}";
		},

		"+": function() {
			var args = [].slice.call( arguments, 0 );
			var terms = jQuery.grep( args, function( term, i ) {
				return term != null;
			} );

			terms = jQuery.map(terms, function( term, i ) {
				var parenthesize;
				switch ( KhanUtil.exprType(term) ) {
					case "+":
					parenthesize = true;
					break;

					case "-":
					parenthesize = (term.length > 2);
					break;

					default:
					// case "*":
					// case "/":
					// case "^":
					parenthesize = false;
				}

				term = KhanUtil.exprToString( term );

				if ( parenthesize ) {
					term = "(" + term + ")";
				}

				if ( term.charAt(0) !== "-" || parenthesize ) {
					term = "+" + term;
				}

				return term;
			});

			var joined = terms.join("");

			if(joined.charAt(0) === "+") {
				return joined.slice(1);
			} else {
				return joined;
			}
		},

		"-": function() {
			if ( arguments.length === 1 ) {
				return KhanUtil.exprToString( {op:"*", params:[-1, arguments[0]]} );
			} else {
				var args = [].slice.call( arguments, 0 );
				var terms = jQuery.map( args, function( term, i ) {
					var negate = KhanUtil.exprIsNegated( term );
					var parenthesize;
					switch ( KhanUtil.exprType(term) ) {
						case "+":
						case "-":
						parenthesize = true;
						break;

						default:
						// case "*":
						// case "/":
						// case "^":
						parenthesize = false;
					}

					term = KhanUtil.exprToString( term );

					if ( ( negate && i > 0 ) || parenthesize ) {
						term = "(" + term + ")";
					}

					return term;
				} );

				var joined = terms.join("-");

				return joined;
			}
		},

		"*": function() {
			var rest = Array.prototype.slice.call(arguments, 1);
			rest = {op:"*", params:rest};

			// If we're multiplying by 1, ignore it, unless we have [ "*", 1 ] and
			// should return 1
			if ( arguments[0] === 1 && rest.length > 1 ) {
				return KhanUtil.exprToString(rest);
			} else if ( arguments[0] === -1 && rest.length > 1 ) {
				var form = KhanUtil.exprToString(rest);
				if( KhanUtil.exprIsNegated(rest[1]) ) {
					return "-(" + form + ")";
				} else {
					return "-" + form;
				}
			}

			if ( arguments.length > 1 ) {
				var args = [].slice.call( arguments, 0 );
				var parenthesizeRest = KhanUtil.exprType(arguments[0]) === "number"
					&& KhanUtil.exprType(arguments[1]) === "number";
				var factors = jQuery.map( args, function( factor, i ) {
					var parenthesize;
					switch ( KhanUtil.exprType( factor ) ) {
						case "number":
						if ( i > 0 ) {
							parenthesize = true;
						}
						break;

						default:
						parenthesize = !KhanUtil.exprIsShort( factor );
						break;
					}

					parenthesizeRest || ( parenthesizeRest = parenthesize );
					factor = KhanUtil.exprToString( factor );

					if ( parenthesizeRest ) {
						factor = "(" + factor + ")";
					}

					return factor;
				} );

				return factors.join("");
			} else {
				return KhanUtil.exprToString(arguments[0]);
			}
		},

		"times": function( left, right ) {
			var parenthesizeLeft = !KhanUtil.exprIsShort(left);
			var parenthesizeRight = !KhanUtil.exprIsShort(right);

			left = KhanUtil.exprToString( left );
			right = KhanUtil.exprToString( right );

			left = parenthesizeLeft ? "(" + left + ")" : left;
			right = parenthesizeRight ? "(" + right + ")" : right;

			return left + " \\times " + right;
		},

		"/": function( num, den ) {
			var parenthesizeNum = !KhanUtil.exprIsShort(num);
			var parenthesizeDen = !KhanUtil.exprIsShort(den);

			num = KhanUtil.exprToString( num );
			den = KhanUtil.exprToString( den );

			num = parenthesizeNum ? "(" + num + ")" : num;
			den = parenthesizeDen ? "(" + den + ")" : den;

			return num + "/" + den;
		},

		"frac": function( num, den ) {
			return "\\frac{" + KhanUtil.exprToString( num ) + "}{" +
				KhanUtil.exprToString( den ) + "}";
		},

		"^": function( base, pow ) {
			var parenthesizeBase, trigFunction;
			switch ( KhanUtil.exprType(base) ) {
				case "+":
				case "-":
				case "*":
				case "/":
				case "^":
				case "ln":
				parenthesizeBase = true;
				break;

				case "number":
				parenthesizeBase = base < 0;
				break;

				case "sin":
				case "cos":
				case "tan":
				case "csc":
				case "sec":
				case "cot":
				parenthesizeBase = false;
				trigFunction = true;
				break;

				default:
				parenthesizeBase = false;
				trigFunction = false;
			}

			base = KhanUtil.exprToString( base );
			if ( parenthesizeBase ) {
				base = "(" + base + ")";
			}

			pow = KhanUtil.exprToString( pow );

			if ( trigFunction ) {
				return base.replace( /\\(\S+?)\{/, function( match, word ) {
					return "\\" + word + "^{" + pow + "} {";
				} );
			} else {
				return base + "^{" + pow + "}";
			}
		},

		"sqrt": function( arg ) {
			return "\\sqrt{" + KhanUtil.exprParenthesize( arg ) + "}";
		},

		"sin": function( arg ) {
			return "\\sin{" + KhanUtil.exprParenthesize( arg ) + "}";
		},

		"cos": function( arg ) {
			return "\\cos{" + KhanUtil.exprParenthesize( arg ) + "}";
		},

		"tan": function( arg ) {
			return "\\tan{" + KhanUtil.exprParenthesize( arg ) + "}";
		},

		"sec": function( arg ) {
			return "\\sec{" + KhanUtil.exprParenthesize( arg ) + "}";
		},

		"csc": function( arg ) {
			return "\\sec{" + KhanUtil.exprParenthesize( arg ) + "}";
		},

		"cot": function( arg ) {
			return "\\sec{" + KhanUtil.exprParenthesize( arg ) + "}";
		},

		"ln": function( arg ) {
			return "\\ln{" + KhanUtil.exprParenthesize( arg ) + "}";
		},

		"+-": function() {
			if ( arguments.length === 1 ) {
				return "\\pm " + KhanUtil.exprParenthesize(arguments[0]);
			} else {
				var args = [].slice.call( arguments, 0 );
				return jQuery.map( args, function( term, i ) {
					return KhanUtil.exprToString(term);
				} ).join(" \\pm ");
			}
		}
	},

	computeOperators: {
		"color": function(params) {
			return params[1];
		},

		"+": function(params) {
			var sum = 0;
			jQuery.each(params, function(i, term) {
				sum += term;
			} );
			return sum;
		},

		"-": function(params) {
			if (params.length === 1) {
				return -params[0];
			} else {
				var sum = 0;
				jQuery.each( params, function( iTerm, term ) {
					sum += ( iTerm === 0 ? 1 : -1 ) * term;
				});
				return sum;
			}
		},

		"*": function(params) {
			var prod = 1;

			jQuery.each(params, function(iTerm, term) {
				prod *= term;
			});

			return prod;
		},

		"/": function(params) {
			var prod = 1;
			jQuery.each(params, function(iTerm, term) {
				prod *= (iTerm === 0 ? term : 1 / term);
			} );
			return prod;
		},

		"^": function(params) {
			return Math.pow(params[0], params[1]);
		},

		"sqrt": function(params) {
			return Math.sqrt(params[0]);
		},

		"+-": function() {
			return Number.NaN;
		},

		"sin": function(params) {
			return Math.sin(params[0]);
		},

		"cos": function(params) {
			return Math.cos(params[0]);
		},

		"tan": function(params) {
			return Math.tan(params[0]);
		},

		"sec": function(params) {
			return 1 / Math.cos(params[0]);
		},

		"ln": function(params) {
			return Math.log(params[0]);
		},

		"left": function(params) {
			return params[0];
		},

		"(": function(params) {
			return params[0];
		},
	},

	// Remove [ "color", ...] tags from an expression
	exprStripColor: function( expr ) {
		if ( typeof expr !== "object" ) {
			return expr;
		} else if ( expr.op === "color" ) {
			return KhanUtil.exprStripColor( expr.params[1] );
		} else {
			return {op:expr.op, params:jQuery.map(expr.params, function( el, i ) {

				// Wrap in an array because jQuery.map flattens the result by one level
				return [ KhanUtil.exprStripColor( el ) ]; // TO CHECK
			})};
		}
	},

	// simplify an expression by collapsing all the associative
	// operations.  e.g. ["+", ["+", 1, 2], 3] -> ["+", 1, 2, 3]
	exprSimplifyAssociative : function (expr) {
		if ( typeof expr !== "object" ){
			return expr;
		}

		var simplified = jQuery.map( expr.params, function(x){
			//encapsulate in a list so jQuery.map unpacks it correctly
			return [KhanUtil.exprSimplifyAssociative(x)];
		});

		var flattenOneLevel = function (e) {  // TO CHECK
			switch( expr.op ){
				case "+":
				if ( e.op === "+" ) {
					return e.params;
				}
				break;

				case "*":
				if ( e.op === "*" ) {
					return e.params;
				}
				break;
			}
			//make sure that we encapsulate e in an array so jQuery's map
			//does't accidently unpacks e itself.
			return e;
		};

		//here we actually want the jQuery behavior of
		//having any lists that flattenOneLevel returns merged into
		//the result
		var ret = jQuery.map( simplified, flattenOneLevel );
		ret.unshift( expr.op );

		return ret;
	}
});

KhanUtil.computeOperators["frac"] = KhanUtil.computeOperators["/"];
